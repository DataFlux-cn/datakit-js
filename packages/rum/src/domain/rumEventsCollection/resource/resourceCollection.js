import {
  msToNs,
  getStatusGroup,
  UUID,
  extend2Lev,
  relativeToClocks,
  urlParse,
  getQueryParamsFromUrl,
  replaceNumberCharByPath,
  jsonStringify,
  RequestType,
  ResourceType,
  RumEventType,
  LifeCycleEventType
} from '@cloudcare/browser-core'

import { matchRequestTiming } from './matchRequestTiming'
import {
  computePerformanceResourceDetails,
  computePerformanceResourceDuration,
  computeResourceKind,
  computeSize,
  isRequestKind,
  is304,
  isCacheHit
} from './resourceUtils'

export function startResourceCollection(lifeCycle, configuration, session) {
  lifeCycle.subscribe(LifeCycleEventType.REQUEST_COMPLETED, function (request) {
    if (session.isTrackedWithResource()) {
      lifeCycle.notify(
        LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
        processRequest(request)
      )
    }
  })

  lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRY_COLLECTED,
    function (entry) {
      if (
        session.isTrackedWithResource() &&
        entry.entryType === 'resource' &&
        !isRequestKind(entry)
      ) {
        lifeCycle.notify(
          LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
          processResourceEntry(entry)
        )
      }
    }
  )
}

function processRequest(request) {
  var type =
    request.type === RequestType.XHR ? ResourceType.XHR : ResourceType.FETCH
  var matchingTiming = matchRequestTiming(request)
  var startClocks = matchingTiming
    ? relativeToClocks(matchingTiming.startTime)
    : request.startClocks
  var correspondingTimingOverrides = matchingTiming
    ? computePerformanceEntryMetrics(matchingTiming)
    : undefined
  var tracingInfo = computeRequestTracingInfo(request)
  var urlObj = urlParse(request.url).getParse()
  var resourceEvent = extend2Lev(
    {
      date: startClocks.timeStamp,
      resource: {
        type: type,
        duration: msToNs(request.duration),
        method: request.method,
        status: request.status,
        statusGroup: getStatusGroup(request.status),
        url: request.url,
        urlHost: urlObj.Host,
        urlPath: urlObj.Path,
        urlPathGroup: replaceNumberCharByPath(urlObj.Path),
        urlQuery: jsonStringify(getQueryParamsFromUrl(request.url))
      },
      type: RumEventType.RESOURCE
    },
    tracingInfo,
    correspondingTimingOverrides
  )
  return { startTime: startClocks.relative, rawRumEvent: resourceEvent }
}

function processResourceEntry(entry) {
  var type = computeResourceKind(entry)
  var entryMetrics = computePerformanceEntryMetrics(entry)
  var tracingInfo = computeEntryTracingInfo(entry)
  var urlObj = urlParse(entry.name).getParse()
  var statusCode = ''
  if (is304(entry)) {
    statusCode = 304
  } else if (isCacheHit(entry)) {
    statusCode = 200
  }
  var startClocks = relativeToClocks(entry.startTime)
  var resourceEvent = extend2Lev(
    {
      date: startClocks.timeStamp,
      resource: {
        type: type,
        url: entry.name,
        urlHost: urlObj.Host,
        urlPath: urlObj.Path,
        urlPathGroup: replaceNumberCharByPath(urlObj.Path),
        urlQuery: jsonStringify(getQueryParamsFromUrl(entry.name)),
        method: 'GET',
        status: statusCode,
        statusGroup: getStatusGroup(statusCode)
      },
      type: RumEventType.RESOURCE
    },
    tracingInfo,
    entryMetrics
  )
  return { startTime: startClocks.relative, rawRumEvent: resourceEvent }
}

function computePerformanceEntryMetrics(timing) {
  return {
    resource: extend2Lev(
      {},
      {
        duration: computePerformanceResourceDuration(timing),
        size: computeSize(timing)
      },
      computePerformanceResourceDetails(timing)
    )
  }
}

function computeRequestTracingInfo(request) {
  var hasBeenTraced = request.traceId && request.spanId
  if (!hasBeenTraced) {
    return undefined
  }
  return {
    _dd: {
      spanId: request.spanId,
      traceId: request.traceId
    },
    resource: { id: UUID() }
  }
}

function computeEntryTracingInfo(entry) {
  return entry.traceId ? { _dd: { traceId: entry.traceId } } : undefined
}