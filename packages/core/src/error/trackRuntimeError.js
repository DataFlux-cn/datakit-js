import { ErrorSource, formatUnknownError } from '../helper/errorTools'
import { clocksNow } from '../helper/tools'
import { ErrorHandling } from '../helper/enums'
import { startUnhandledErrorCollection } from '../tracekit'

export function trackRuntimeError(errorObservable) {
  return startUnhandledErrorCollection(function(stackTrace, errorObject){
    var _formatUnknownError = formatUnknownError(stackTrace, errorObject, 'Uncaught')
    errorObservable.notify({
      message:_formatUnknownError.message,
      stack: _formatUnknownError.stack,
      type: _formatUnknownError.type,
      source: ErrorSource.SOURCE,
      startClocks: clocksNow(),
      originalError: errorObject,
      handling: ErrorHandling.UNHANDLED,
    })
  })
}
