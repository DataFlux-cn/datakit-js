import { toStackTraceString } from '../helper/errorTools'
import { mergeObservables, Observable } from '../helper/observable'
import { includes, safeTruncate, filter, each } from '../helper/tools'
import { addEventListener } from '../browser/addEventListener'
import { DOM_EVENT } from '../helper/enums'
import { monitor } from '../helper/monitor'
export var RawReportType = {
  intervention: 'intervention',
  deprecation: 'deprecation',
  cspViolation: 'csp_violation'
}
export function initReportObservable(configuration, apis) {
  var observables = []

  if (includes(apis, RawReportType.cspViolation)) {
    observables.push(createCspViolationReportObservable(configuration))
  }

  var reportTypes = filter(apis, function (api) {
    return api !== RawReportType.cspViolation
  })
  if (reportTypes.length) {
    observables.push(createReportObservable(reportTypes))
  }
  return mergeObservables.apply(this, observables)
}

function createReportObservable(reportTypes) {
  return new Observable(function (observable) {
    if (!window.ReportingObserver) {
      return
    }

    var handleReports = monitor(function (reports) {
      each(reports, function (report) {
        observable.notify(buildRawReportFromReport(report))
      })
    })

    var observer = new window.ReportingObserver(handleReports, {
      types: reportTypes,
      buffered: true
    })

    observer.observe()
    return function () {
      observer.disconnect()
    }
  })

  return observable
}

function createCspViolationReportObservable(configuration) {
  return new Observable(function (observable) {
    var handleCspViolation = function (event) {
      observable.notify(buildRawReportFromCspViolation(event))
    }

    var _addEventListener = addEventListener(
      document,
      DOM_EVENT.SECURITY_POLICY_VIOLATION,
      handleCspViolation
    )

    return _addEventListener.stop
  })
  return observable
}

function buildRawReportFromReport(report) {
  var body = report.body
  var type = report.type
  return {
    type: type,
    subtype: body.id,
    message: type + ': ' + body.message,
    stack: buildStack(
      body.id,
      body.message,
      body.sourceFile,
      body.lineNumber,
      body.columnNumber
    )
  }
}

function buildRawReportFromCspViolation(event) {
  var type = RawReportType.cspViolation
  var message =
    "'" +
    event.blockedURI +
    "' blocked by '" +
    event.effectiveDirective +
    "' directive"
  return {
    type: RawReportType.cspViolation,
    subtype: event.effectiveDirective,
    message: type + ': ' + message,
    stack: buildStack(
      event.effectiveDirective,
      message +
        ' of the policy "' +
        safeTruncate(event.originalPolicy, 100, '...') +
        '"',
      event.sourceFile,
      event.lineNumber,
      event.columnNumber
    )
  }
}

function buildStack(name, message, sourceFile, lineNumber, columnNumber) {
  return (
    sourceFile &&
    toStackTraceString({
      name: name,
      message: message,
      stack: [
        {
          func: '?',
          url: sourceFile,
          line: lineNumber,
          column: columnNumber
        }
      ]
    })
  )
}
