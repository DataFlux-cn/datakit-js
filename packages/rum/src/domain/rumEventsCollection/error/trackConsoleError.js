import { clocksNow, ErrorHandling, initConsoleObservable, ErrorSource, ConsoleApiName } from '@cloudcare/browser-core'

export function trackConsoleError(errorObservable) {
  var subscription = initConsoleObservable([ConsoleApiName.error]).subscribe(function(consoleError) {
      errorObservable.notify({
        startClocks: clocksNow(),
        message: consoleError.message,
        stack: consoleError.stack,
        source: ErrorSource.CONSOLE,
        handling: ErrorHandling.HANDLED,
        handlingStack: consoleError.handlingStack,
      })
    }
  )

  return {
    stop: function() {
      subscription.unsubscribe()
    },
  }
}
