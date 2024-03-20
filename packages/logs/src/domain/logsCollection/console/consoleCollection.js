import {
  timeStampNow,
  ConsoleApiName,
  ErrorSource,
  initConsoleObservable,
  LifeCycleEventType
} from '@cloudcare/browser-core'
import { StatusType } from '../../logger'

var LogStatusForApi = {
  [ConsoleApiName.log]: StatusType.info,
  [ConsoleApiName.debug]: StatusType.debug,
  [ConsoleApiName.info]: StatusType.info,
  [ConsoleApiName.warn]: StatusType.warn,
  [ConsoleApiName.error]: StatusType.error
}
export function startConsoleCollection(configuration, lifeCycle) {
  var consoleSubscription = initConsoleObservable(
    configuration.forwardConsoleLogs
  ).subscribe(function (log) {
    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: {
        date: timeStampNow(),
        message: log.message,
        origin: ErrorSource.CONSOLE,
        error:
          log.api === ConsoleApiName.error
            ? {
                origin: ErrorSource.CONSOLE,
                stack: log.stack,
                causes: log.causes
              }
            : undefined,
        status: LogStatusForApi[log.api]
      }
    })
  })

  return {
    stop: function () {
      consoleSubscription.unsubscribe()
    }
  }
}
