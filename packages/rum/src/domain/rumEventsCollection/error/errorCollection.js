import {
  startAutomaticErrorCollection,
  getTimestamp,
  getStatusGroup,
  urlParse,
  replaceNumberCharByPath,
  RumEventType,
  LifeCycleEventType,
  computeStackTrace,
  formatUnknownError,
  ErrorHandling,
  extend,
  extend2Lev,
  ErrorSource
} from '@cloudcare/browser-core'
export function startErrorCollection(lifeCycle, configuration) {
  startAutomaticErrorCollection(configuration).subscribe(function (error) {
    lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, { error: error })
  })
  return doStartErrorCollection(lifeCycle)
}

export function doStartErrorCollection(lifeCycle) {
  lifeCycle.subscribe(LifeCycleEventType.RAW_ERROR_COLLECTED, function (error) {
    lifeCycle.notify(
      LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
      extend({
        customerContext:error.customerContext,
        savedCommonContext: error.savedCommonContext,
      }, processError(error.error))
      
    )
  })
  return {
    addError: function (customError, savedCommonContext) {
      var rawError = computeRawError(
        customError.error,
        customError.handlingStack,
        customError.startClocks,
      )
      lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, {
        customerContext: customError.context,
        savedCommonContext: savedCommonContext,
        error: rawError
      })
    }
  }
}
function computeRawError(error, handlingStack, startClocks) {
  const stackTrace = error instanceof Error ? computeStackTrace(error) : undefined
  return extend({
    startClocks:startClocks,
    source: ErrorSource.CUSTOM,
    originalError: error,
    handling: ErrorHandling.HANDLED,
  },formatUnknownError(stackTrace, error, 'Provided', handlingStack))
}
function processError(error) {
  var resource = error.resource
  var tracingInfo
  if (resource) {
    tracingInfo = computeRequestTracingInfo(resource)
    var urlObj = urlParse(error.resource.url).getParse()
    resource = {
      method: error.resource.method,
      status: error.resource.statusCode,
      statusGroup: getStatusGroup(error.resource.statusCode),
      url: error.resource.url,
      urlHost: urlObj.Host,
      urlPath: urlObj.Path,
      urlPathGroup: replaceNumberCharByPath(urlObj.Path)
    }
  }

  var rawRumEvent = extend2Lev({
    date: error.startClocks.timeStamp,
    error: {
      message: error.message,
      resource: resource,
      source: error.source,
      stack: error.stack,
      type: error.type,
      handling_stack: error.handlingStack,
      handling: error.handling,
      starttime: getTimestamp(error.startClocks.relative)
    },
    type: RumEventType.ERROR
  }, tracingInfo)
  return {
    rawRumEvent: rawRumEvent,
    startTime: error.startClocks.relative
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
    }
  }
}