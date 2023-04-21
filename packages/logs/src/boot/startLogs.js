import {
  ErrorSource,
  LifeCycle,
  LifeCycleEventType,
  createPageExitObservable,
  areCookiesAuthorized
} from '@cloudcare/browser-core'
import {
  startLogsSessionManager,
  startLogsSessionManagerStub
} from '../domain/logsSessionManager'
import { startLogsAssembly } from '../domain/assembly'
import { startConsoleCollection } from '../domain/logsCollection/console/consoleCollection'
import { startReportCollection } from '../domain/logsCollection/report/reportCollection'
import { startNetworkErrorCollection } from '../domain/logsCollection/networkError/networkErrorCollection'
import { startRuntimeErrorCollection } from '../domain/logsCollection/rumtimeError/runtimeErrorCollection'
import { startLoggerCollection } from '../domain/logsCollection/logger/loggerCollection'
import { startLogsBatch } from '../transport/startLogsBatch'
import { StatusType } from '../domain/logger'
import { startInternalContext } from '../domain/internalContext'

export function startLogs(configuration, buildCommonContext, mainLogger) {
  var lifeCycle = new LifeCycle()

  var reportError = function (error) {
    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: {
        message: error.message,
        date: error.startClocks.timeStamp,
        error: {
          origin: ErrorSource.AGENT // Todo: Remove in the next major release
        },
        origin: ErrorSource.AGENT,
        status: StatusType.error
      }
    })
  }
  var pageExitObservable = createPageExitObservable()
  var session = areCookiesAuthorized(configuration.cookieOptions)
    ? startLogsSessionManager(configuration)
    : startLogsSessionManagerStub(configuration)
  startNetworkErrorCollection(configuration, lifeCycle)
  startRuntimeErrorCollection(configuration, lifeCycle)
  startConsoleCollection(configuration, lifeCycle)
  startReportCollection(configuration, lifeCycle)
  var _startLoggerCollection = startLoggerCollection(lifeCycle)

  startLogsAssembly(
    session,
    configuration,
    lifeCycle,
    buildCommonContext,
    mainLogger,
    reportError
  )

  startLogsBatch(
    configuration,
    lifeCycle,
    reportError,
    pageExitObservable,
    session.expireObservable
  )

  var internalContext = startInternalContext(session)

  return {
    handleLog: _startLoggerCollection.handleLog,
    getInternalContext: internalContext.get
  }
}
