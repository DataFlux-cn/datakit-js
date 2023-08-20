import {
  assign,
  computeStackTrace,
  computeRawError,
  ErrorSource,
  UUID,
  ErrorHandling,
  Observable,
  trackRuntimeError,
  RumEventType,
  LifeCycleEventType,
  NonErrorPrefix
} from '@cloudcare/browser-core'
import { trackConsoleError } from './trackConsoleError'
import { trackReportError } from './trackReportError'

export function startErrorCollection(lifeCycle, foregroundContexts) {
  var errorObservable = new Observable()

  trackConsoleError(errorObservable)
  trackRuntimeError(errorObservable)
  trackReportError(errorObservable)

  errorObservable.subscribe(function (error) {
    lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, { error: error })
  })

  return doStartErrorCollection(lifeCycle, foregroundContexts)
}

export function doStartErrorCollection(lifeCycle, foregroundContexts) {
  lifeCycle.subscribe(LifeCycleEventType.RAW_ERROR_COLLECTED, function (error) {
    lifeCycle.notify(
      LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
      assign(
        {
          customerContext: error.customerContext,
          savedCommonContext: error.savedCommonContext
        },
        processError(error.error, foregroundContexts)
      )
    )
  })

  return {
    addError: function (providedError, savedCommonContext) {
      var error = providedError.error
      var stackTrace =
        error instanceof Error ? computeStackTrace(error) : undefined
      var rawError = computeRawError({
        stackTrace,
        originalError: error,
        handlingStack: providedError.handlingStack,
        startClocks: providedError.startClocks,
        nonErrorPrefix: NonErrorPrefix.PROVIDED,
        source: ErrorSource.CUSTOM,
        handling: ErrorHandling.HANDLED
      })
      lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, {
        customerContext: providedError.context,
        savedCommonContext: savedCommonContext,
        error: rawError
      })
    }
  }
}

function processError(error, foregroundContexts) {
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
      causes: error.causes,
      source_type: 'browser'
    },
    type: RumEventType.ERROR
  }
  var inForeground = foregroundContexts.isInForegroundAt(
    error.startClocks.relative
  )
  if (inForeground) {
    rawRumEvent.view = { in_foreground: inForeground }
  }
  return {
    rawRumEvent: rawRumEvent,
    startTime: error.startClocks.relative,
    domainContext: {
      error: error.originalError
    }
  }
}
