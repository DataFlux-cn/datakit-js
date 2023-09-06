import {
  timeStampNow,
  ErrorSource,
  RawReportType,
  getFileFromStackTraceString,
  initReportObservable,
  LifeCycleEventType
} from '@cloudcare/browser-core'
import { StatusType } from '../../logger'

var LogStatusForReport = {
  [RawReportType.cspViolation]: StatusType.error,
  [RawReportType.intervention]: StatusType.error,
  [RawReportType.deprecation]: StatusType.warn
}

export function startReportCollection(configuration, lifeCycle) {
  var reportSubscription = initReportObservable(
    configuration,
    configuration.forwardReports
  ).subscribe(function (report) {
    var message = report.message
    var status = LogStatusForReport[report.type]
    var error
    if (status === StatusType.error) {
      error = {
        kind: report.subtype,
        origin: ErrorSource.REPORT, // Todo: Remove in the next major release
        stack: report.stack
      }
    } else if (report.stack) {
      message += ' Found in ' + getFileFromStackTraceString(report.stack)
    }

    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: {
        date: timeStampNow(),
        message: message,
        origin: ErrorSource.REPORT,
        error: error,
        status: status
      }
    })
  })

  return {
    stop: function () {
      reportSubscription.unsubscribe()
    }
  }
}
