import {
  assign,
  computeStackTrace,
  formatUnknownError,
  ErrorSource,
  UUID,
  ErrorHandling,
  Observable,
  trackRuntimeError,
  RumEventType,
  LifeCycleEventType
} from '@cloudcare/browser-core'
import { trackConsoleError } from './trackConsoleError'
import { trackReportError } from './trackReportError'

export function startErrorCollection(lifeCycle) {
  var errorObservable = new Observable()

  trackConsoleError(errorObservable)
  trackRuntimeError(errorObservable)
  trackReportError(errorObservable)

  errorObservable.subscribe(function(error) { lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, { error: error })})

  return doStartErrorCollection(lifeCycle)
}

export function doStartErrorCollection(lifeCycle) {
  lifeCycle.subscribe(LifeCycleEventType.RAW_ERROR_COLLECTED, function(error){
    lifeCycle.notify(
      LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
      assign(
        {
          customerContext: error.customerContext,
          savedCommonContext: error.savedCommonContext,
        },
        processError(error.error)
      )
    )
  })

  return {
    addError: function(
      providedError,
      savedCommonContext
    ) {
      var rawError = computeRawError(providedError.error, providedError.handlingStack, providedError.startClocks)
      lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, {
        customerContext: providedError.context,
        savedCommonContext: savedCommonContext,
        error: rawError,
      })
    },
  }
}

function computeRawError(error, handlingStack, startClocks) {
  var stackTrace = error instanceof Error ? computeStackTrace(error) : undefined
  return assign(
    {
      startClocks: startClocks,
      source: ErrorSource.CUSTOM,
      originalError: error,
      handling: ErrorHandling.HANDLED,
    },
    formatUnknownError(stackTrace, error, 'Provided', handlingStack)
  )
}

function processError(
  error,
){
  var rawRumEvent = {
    date: error.startClocks.timeStamp,
    error: {
      id: UUID(),
      message: error.message,
      source: error.source,
      stack: error.stack,
      handling_stack: error.handlingStack,
      type: error.type,
      handling: error.handling,
      source_type: 'browser',
    },
    type: RumEventType.ERROR,
  }
  return {
    rawRumEvent: rawRumEvent,
    startTime: error.startClocks.relative,
    domainContext: {
      error: error.originalError,
    },
  }
}
