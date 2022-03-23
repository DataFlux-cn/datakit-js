import {
  startAutomaticErrorCollection,
  getTimestamp,
  getStatusGroup,
  urlParse,
  replaceNumberCharByPath,
  RumEventType,
  LifeCycleEventType,
  formatUnknownError,
  computeStackTrace,
  ErrorHandling,
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
      processError(error.error)
    )
  })
  return {
    addError: function (customError, savedCommonContext) {
      var rawError = computeRawError(
        customError.error,
        customError.startClocks,
        customError.source
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
  return {
    startClocks,
    source: ErrorSource.CUSTOM,
    originalError: error,
    ...formatUnknownError(stackTrace, error, 'Provided', handlingStack),
    handling: ErrorHandling.HANDLED,
  }
}
function processError(error) {
  var resource = error.resource
  if (resource) {
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

  var rawRumEvent = {
    date: getTimestamp(error.startClocks.relative),
    error: {
      message: error.message,
      resource: resource,
      source: error.source,
      stack: error.stack,
      type: error.type,
      starttime: getTimestamp(error.startClocks.relative)
    },
    type: RumEventType.ERROR
  }
  return {
    rawRumEvent: rawRumEvent,
    startTime: error.startClocks.relative
  }
}
