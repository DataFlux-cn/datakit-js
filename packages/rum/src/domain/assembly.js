import {
  extend2Lev,
  withSnakeCaseKeys,
  timeStampNow,
  isEmptyObject,
  LifeCycleEventType,
  RumEventType,
  deviceInfo,
  createErrorFilter,
  limitModification
} from '@cloudcare/browser-core'
var SessionType = {
  SYNTHETICS: 'synthetics',
  USER: 'user'
}
var FIELDS_WITH_SENSITIVE_DATA = [
  'view.url',
  'view.referrer',
  'action.target.name',
  'error.message',
  'error.stack',
  'error.resource.url',
  'resource.url'
]
export function startRumAssembly(
  applicationId,
  configuration,
  lifeCycle,
  session,
  parentContexts,
  getCommonContext
) {
  var errorFilter = createErrorFilter(configuration, function (error) {
    lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, { error: error })
  })
  lifeCycle.subscribe(
    LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
    function (data) {
      var startTime = data.startTime
      var rawRumEvent = data.rawRumEvent
      var savedCommonContext = data.savedGlobalContext
      var customerContext = data.customerContext
      var viewContext = parentContexts.findView(startTime)
      var deviceContext = {
        device: deviceInfo
      }
      if (
        session.isTracked() &&
        viewContext &&
        viewContext.session.id === session.getId()
      ) {
        var actionContext = parentContexts.findAction(startTime)
        var commonContext = savedCommonContext || getCommonContext()
        var rumContext = {
          _dd: {
            sdkName: configuration.sdkName,
            sdkVersion: configuration.sdkVersion,
            env: configuration.env,
            version: configuration.version
          },
          tags: configuration.tags,
          terminal: {
            type: 'web'
          },
          application: {
            id: applicationId
          },
          device: {},
          date: timeStampNow(),
          user: {
            user_id: configuration.user_id || session.getAnonymousID(),
            is_signin: configuration.user_id ? 'T' : 'F'
          },
          session: {
            // must be computed on each event because synthetics instrumentation can be done after sdk execution
            // cf https://github.com/puppeteer/puppeteer/issues/3667
            type: getSessionType()
          }
        }

        var rumEvent = needToAssembleWithAction(rawRumEvent)
          ? extend2Lev(
              rumContext,
              deviceContext,
              viewContext,
              actionContext,
              rawRumEvent
            )
          : extend2Lev(rumContext, deviceContext, viewContext, rawRumEvent)
        var serverRumEvent = withSnakeCaseKeys(rumEvent)
        var context = extend2Lev(commonContext.context, customerContext)
        if (!isEmptyObject(context)) {
          serverRumEvent.context = context
        }
        if (!('has_replay' in serverRumEvent.session)) {
          serverRumEvent.session.has_replay = commonContext.hasReplay
        }
        if (!isEmptyObject(commonContext.user)) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          serverRumEvent.usr = commonContext.user
        }

        if (shouldSend(serverRumEvent, configuration.beforeSend, errorFilter)) {
          // if (
          //   serverRumEvent.type === 'long_task' ||
          //   serverRumEvent.type === 'action'
          // ) {
          //   console.log(serverRumEvent, '======serverRumEvent-====')
          // }
          // console.log(serverRumEvent, '======serverRumEvent-====')
          lifeCycle.notify(
            LifeCycleEventType.RUM_EVENT_COLLECTED,
            serverRumEvent
          )
        }
      }
    }
  )
}

function shouldSend(event, beforeSend, errorFilter) {
  if (beforeSend) {
    var result = limitModification(
      event,
      FIELDS_WITH_SENSITIVE_DATA,
      beforeSend
    )
    if (result === false && event.type !== RumEventType.VIEW) {
      return false
    }
    if (result === false) {
      console.warn(`Can't dismiss view events using beforeSend!`)
    }
  }
  if (event.type === RumEventType.ERROR) {
    return !errorFilter.isLimitReached()
  }
  return true
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
