import {
  getStatusGroup,
  UUID,
  extend2Lev,
  relativeToClocks,
  urlParse,
  getQueryParamsFromUrl,
  replaceNumberCharByPath,
  RequestType,
  ResourceType,
  RumEventType,
  LifeCycleEventType,
  toServerDuration,
  some,
  isNullUndefinedDefaultValue
} from '@cloudcare/browser-core'
import { matchRequestTiming } from './matchRequestTiming'
import {
  computePerformanceResourceDetails,
  computePerformanceResourceDuration,
  computeResourceKind,
  computeSize,
  isRequestKind,
  is304,
  isCacheHit,
  isResourceUrlLimit,
  isLongDataUrl,
  sanitizeDataUrl
} from './resourceUtils'
import { PageState } from '../../contexts/pageStateHistory.js'
export function startResourceCollection(
  lifeCycle,
  configuration,
  sessionManager,
  pageStateHistory
) {
  lifeCycle.subscribe(LifeCycleEventType.REQUEST_COMPLETED, function (request) {
    var rawEvent = processRequest(
      request,
      configuration,
      sessionManager,
      pageStateHistory
    )
    if (rawEvent) {
      lifeCycle.notify(LifeCycleEventType.RAW_RUM_EVENT_COLLECTED, rawEvent)
    }
  })

  lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i]
        if (
          entry.entryType === 'resource' &&
          !isRequestKind(entry) &&
          !isResourceUrlLimit(entry.name, configuration.resourceUrlLimit)
        ) {
          var rawEvent = processResourceEntry(
            entry,
            configuration,
            sessionManager,
            pageStateHistory
          )
          if (rawEvent) {
            lifeCycle.notify(
              LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
              rawEvent
            )
          }
        }
      }
    }
  )
}

function processRequest(
  request,
  configuration,
  sessionManager,
  pageStateHistory
) {
  var matchingTiming = matchRequestTiming(request)
  var startClocks = matchingTiming
    ? relativeToClocks(matchingTiming.startTime)
    : request.startClocks
  var shouldIndex = shouldIndexResource(
    configuration,
    sessionManager,
    startClocks
  )
  var tracingInfo = computeRequestTracingInfo(request)
  if (!shouldIndex && !tracingInfo) {
    return
  }
  var type =
    request.type === RequestType.XHR ? ResourceType.XHR : ResourceType.FETCH
  var correspondingTimingOverrides = matchingTiming
    ? computePerformanceEntryMetrics(matchingTiming)
    : undefined

  var duration = computeRequestDuration(
    pageStateHistory,
    startClocks,
    request.duration
  )
  var pageStateInfo = computePageStateInfo(
    pageStateHistory,
    startClocks,
    isNullUndefinedDefaultValue(
      matchingTiming && matchingTiming.duration,
      request.duration
    )
  )
  var urlObj = urlParse(request.url).getParse()
  var resourceEvent = extend2Lev(
    {
      date: startClocks.timeStamp,
      resource: {
        id: UUID,
        type: type,
        duration: duration,
        method: request.method,
        status: request.status,
        statusGroup: getStatusGroup(request.status),
        url: isLongDataUrl(request.url)
          ? sanitizeDataUrl(request.url)
          : request.url,
        urlHost: urlObj.Host,
        urlPath: urlObj.Path,
        urlPathGroup: replaceNumberCharByPath(urlObj.Path),
        urlQuery: getQueryParamsFromUrl(request.url)
      },
      type: RumEventType.RESOURCE
    },
    tracingInfo,
    correspondingTimingOverrides,
    pageStateInfo
  )
  return {
    startTime: startClocks.relative,
    rawRumEvent: resourceEvent,
    domainContext: {
      performanceEntry: matchingTiming,
      xhr: request.xhr,
      response: request.response,
      requestInput: request.input,
      requestInit: request.init,
      error: request.error
    }
  }
}

function processResourceEntry(
  entry,
  configuration,
  sessionManager,
  pageStateHistory
) {
  var startClocks = relativeToClocks(entry.startTime)
  var shouldIndex = shouldIndexResource(
    configuration,
    sessionManager,
    startClocks
  )
  var tracingInfo = computeEntryTracingInfo(entry)
  if (!shouldIndex && !tracingInfo) {
    return
  }
  var type = computeResourceKind(entry)
  var entryMetrics = computePerformanceEntryMetrics(entry)
  var urlObj = urlParse(entry.name).getParse()
  var statusCode = ''
  if (entry.responseStatus !== 0) {
    statusCode = entry.responseStatus
  } else if (is304(entry)) {
    statusCode = 304
  } else if (isCacheHit(entry)) {
    statusCode = 200
  }
  var pageStateInfo = computePageStateInfo(
    pageStateHistory,
    startClocks,
    entry.duration
  )

  var resourceEvent = extend2Lev(
    {
      date: startClocks.timeStamp,
      resource: {
        id: UUID(),
        type: type,
        url: entry.name,
        urlHost: urlObj.Host,
        urlPath: urlObj.Path,
        urlPathGroup: replaceNumberCharByPath(urlObj.Path),
        urlQuery: getQueryParamsFromUrl(entry.name),
        method: 'GET',
        status: statusCode,
        statusGroup: getStatusGroup(statusCode)
      },
      type: RumEventType.RESOURCE
    },
    tracingInfo,
    entryMetrics,
    pageStateInfo
  )
  return {
    startTime: startClocks.relative,
    rawRumEvent: resourceEvent,
    domainContext: {
      performanceEntry: entry
    }
  }
}
function shouldIndexResource(configuration, sessionManager, resourceStart) {
  return sessionManager.findTrackedSession(resourceStart.relative)
}

function computePerformanceEntryMetrics(timing) {
  return {
    resource: extend2Lev(
      {},
      {
        duration: computePerformanceResourceDuration(timing)
      },
      computeSize(timing),
      computePerformanceResourceDetails(timing)
    )
  }
}

function computeRequestTracingInfo(request) {
  var hasBeenTraced = request.traceSampled && request.traceId && request.spanId
  if (!hasBeenTraced) {
    return undefined
  }
  return {
    _gc: {
      spanId: request.spanId,
      traceId: request.traceId
    },
    resource: { id: UUID() }
  }
}
function computePageStateInfo(pageStateHistory, startClocks, duration) {
  return {
    _gc: {
      page_states: pageStateHistory.findAll(startClocks.relative, duration),
      page_was_discarded: String(document.wasDiscarded)
    }
  }
}
function computeRequestDuration(pageStateHistory, startClocks, duration) {
  const requestCrosseds = pageStateHistory.findAll(
    startClocks.relative,
    duration
  )
  var requestCrossedFrozenState
  if (requestCrosseds) {
    requestCrossedFrozenState = some(requestCrosseds, function (pageState) {
      return pageState.state === PageState.FROZEN
    })
  }
  return !requestCrossedFrozenState ? toServerDuration(duration) : undefined
}
function computeEntryTracingInfo(entry) {
  return entry.traceId ? { _gc: { traceId: entry.traceId } } : undefined
}
