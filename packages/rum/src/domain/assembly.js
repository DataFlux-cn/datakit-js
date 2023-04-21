import {
  extend2Lev,
  withSnakeCaseKeys,
  timeStampNow,
  isEmptyObject,
  LifeCycleEventType,
  RumEventType,
  deviceInfo,
  currentDrift,
  createEventRateLimiter,
  limitModification,
  display
} from '@cloudcare/browser-core'
var SessionType = {
  SYNTHETICS: 'synthetics',
  USER: 'user'
}

var VIEW_EVENTS_MODIFIABLE_FIELD_PATHS = [
  // Fields with sensitive data
  'view.url',
  'view.referrer',
  'action.target.name',
  'error.message',
  'error.stack',
  'error.resource.url',
  'resource.url'
]

var OTHER_EVENTS_MODIFIABLE_FIELD_PATHS =
  VIEW_EVENTS_MODIFIABLE_FIELD_PATHS.concat([
    // User-customizable field
    'tags'
  ])
export function startRumAssembly(
  configuration,
  lifeCycle,
  sessionManager,
  userSessionManager,
  viewContexts,
  urlContexts,
  actionContexts,
  buildCommonContext,
  reportError
) {
  var eventRateLimiters = {}
  eventRateLimiters[RumEventType.ERROR] = createEventRateLimiter(
    RumEventType.ERROR,
    configuration.eventRateLimiterThreshold,
    reportError
  )
  eventRateLimiters[RumEventType.ACTION] = createEventRateLimiter(
    RumEventType.ACTION,
    configuration.eventRateLimiterThreshold,
    reportError
  )
  lifeCycle.subscribe(
    LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
    function (data) {
      var startTime = data.startTime
      var rawRumEvent = data.rawRumEvent
      var savedCommonContext = data.savedCommonContext
      var customerContext = data.customerContext
      var domainContext = data.domainContext
      var viewContext = viewContexts.findView(startTime)
      var urlContext = urlContexts.findUrl(startTime)
      var session = sessionManager.findTrackedSession(
        rawRumEvent.type !== RumEventType.VIEW ? startTime : undefined
      )
      if (session && viewContext && urlContext) {
        var actionId = actionContexts.findActionId(startTime)
        var commonContext = savedCommonContext || buildCommonContext()
        var rumContext = {
          _dd: {
            sdkName: configuration.sdkName,
            sdkVersion: configuration.sdkVersion,
            drift: currentDrift()
          },
          terminal: {
            type: 'web'
          },
          application: {
            id: configuration.applicationId
          },
          device: deviceInfo,
          env: configuration.env || '',
          service: viewContext.service || configuration.service || 'browser',
          version: viewContext.version || configuration.version || '',
          source: 'browser',
          date: timeStampNow(),
          user: {
            id: userSessionManager.getId(),
            is_signin: 'F'
          },
          session: {
            // must be computed on each event because synthetics instrumentation can be done after sdk execution
            // cf https://github.com/puppeteer/puppeteer/issues/3667
            type: getSessionType(),
            id: session.id
          },
          view: {
            id: viewContext.id,
            name: viewContext.name,
            url: urlContext.url,
            referrer: urlContext.referrer,
            host: urlContext.host,
            path: urlContext.path,
            pathGroup: urlContext.pathGroup,
            urlQuery: urlContext.urlQuery
          },
          action:
            needToAssembleWithAction(rawRumEvent) && actionId
              ? { id: actionId }
              : undefined
        }

        var rumEvent = extend2Lev(rumContext, viewContext, rawRumEvent)
        var serverRumEvent = withSnakeCaseKeys(rumEvent)
        var context = extend2Lev({}, commonContext.context, customerContext)
        if (!isEmptyObject(context)) {
          serverRumEvent.tags = context
        }
        if (!('has_replay' in serverRumEvent.session)) {
          serverRumEvent.session.has_replay = commonContext.hasReplay
        }
        if (!isEmptyObject(commonContext.user)) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          serverRumEvent.user = extend2Lev(
            {
              // id: session.getAnonymousID(),
              is_signin: 'T'
            },
            commonContext.user
          )
        }

        if (
          shouldSend(
            serverRumEvent,
            configuration.beforeSend,
            eventRateLimiters,
            domainContext
          )
        ) {
          if (isEmptyObject(serverRumEvent.tags)) {
            delete serverRumEvent.tags
          }

          lifeCycle.notify(
            LifeCycleEventType.RUM_EVENT_COLLECTED,
            serverRumEvent
          )
        }
      }
    }
  )
}

function shouldSend(event, beforeSend, eventRateLimiters, domainContext) {
  if (beforeSend) {
    var result = limitModification(
      event,
      event.type === RumEventType.VIEW
        ? VIEW_EVENTS_MODIFIABLE_FIELD_PATHS
        : OTHER_EVENTS_MODIFIABLE_FIELD_PATHS,
      function (event) {
        return beforeSend(event, domainContext)
      }
    )
    if (result === false && event.type !== RumEventType.VIEW) {
      return false
    }
    if (result === false) {
      display.warn("Can't dismiss view events using beforeSend!")
    }
  }
  var rateLimitReached = false
  if (eventRateLimiters[event.type]) {
    rateLimitReached = eventRateLimiters[event.type].isLimitReached()
  }
  return !rateLimitReached
}
function needToAssembleWithAction(event) {
  return (
    [RumEventType.ERROR, RumEventType.RESOURCE, RumEventType.LONG_TASK].indexOf(
      event.type
    ) !== -1
  )
}

function getSessionType() {
  return window._DATAFLUX_SYNTHETICS_BROWSER === undefined
    ? SessionType.USER
    : SessionType.SYNTHETICS
}
