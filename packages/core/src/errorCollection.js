import {
  toArray,
  jsonStringify,
  find,
  clocksNow,
  map,
  extend
} from './helper/tools'
import {
  ErrorSource,
  ErrorHandling,
  formatUnknownError,
  toStackTraceString,
  formatErrorMessage,
  createHandlingStack
} from './helper/errorTools'
import { computeStackTrace, subscribe, unsubscribe } from './tracekit'
import { Observable } from './helper/observable'
import { isIntakeRequest } from './configuration'
import { RequestType } from './helper/enums'
import { resetXhrProxy, startXhrProxy } from './xhrProxy'
import { resetFetchProxy, startFetchProxy } from './fetchProxy'

var errorObservable

export function startAutomaticErrorCollection(configuration) {
  if (!errorObservable) {
    errorObservable = new Observable()
    trackNetworkError(configuration, errorObservable)
    startConsoleTracking(errorObservable)
    startRuntimeErrorTracking(errorObservable)
  }
  return errorObservable
}

var originalConsoleError

export function startConsoleTracking(errorObservable) {
  originalConsoleError = console.error
  console.error = function () {
    originalConsoleError.apply(console, arguments)
    const handlingStack = createHandlingStack()
    errorObservable.notify(
      extend({}, buildErrorFromParams(toArray(arguments), handlingStack), {
        source: ErrorSource.CONSOLE,
        startClocks: clocksNow(),
        handling: ErrorHandling.HANDLED
      })
    )
  }
}

function buildErrorFromParams(params, handlingStack) {
  var firstErrorParam = find(params, function (param) {
    return param instanceof Error
  })
  var message = ''
  message = map(['console error:'].concat(params), function (param) {
    return formatConsoleParameters(param)
  }).join(' ')
  return {
    message: message,
    stack: firstErrorParam
      ? toStackTraceString(computeStackTrace(firstErrorParam))
      : undefined,
    handlingStack: handlingStack
  }
}

export function stopConsoleTracking() {
  console.error = originalConsoleError
}

function formatConsoleParameters(param) {
  if (typeof param === 'string') {
    return param
  }
  if (param instanceof Error) {
    return formatErrorMessage(computeStackTrace(param))
  }
  return jsonStringify(param, undefined, 2)
}

var traceKitReportHandler

export function startRuntimeErrorTracking(errorObservable) {
  traceKitReportHandler = function (stackTrace, _, errorObject) {
    var error = formatUnknownError(stackTrace, errorObject, 'Uncaught')
    errorObservable.notify({
      message: error.message,
      stack: error.stack,
      type: error.type,
      source: ErrorSource.SOURCE,
      startClocks: clocksNow(),
      handling: ErrorHandling.UNHANDLED
    })
  }

  subscribe(traceKitReportHandler)
}

export function stopRuntimeErrorTracking() {
  unsubscribe(traceKitReportHandler)
}

export function trackNetworkError(configuration, errorObservable) {
  startXhrProxy().onRequestComplete(function (context) {
    handleCompleteRequest(RequestType.XHR, context)
  })
  startFetchProxy().onRequestComplete(function (context) {
    handleCompleteRequest(RequestType.FETCH, context)
  })

  function handleCompleteRequest(type, request) {
    if (
      !isIntakeRequest(request.url, configuration) &&
      !request.isAborted &&
      (isRejected(request) || isServerError(request) || configuration.isServerError(request))
    ) {
      errorObservable.notify({
        message: format(type) + ' error ' + request.method + ' ' + request.url,
        resource: {
          method: request.method,
          statusCode: request.status,
          url: request.url
        },
        source: ErrorSource.NETWORK,
        stack:
          truncateResponse(request.response, configuration) || 'Failed to load',
        startClocks: request.startClocks
      })
    }
  }

  return {
    stop: () => {
      resetXhrProxy()
      resetFetchProxy()
    }
  }
}

function isRejected(request) {
  return request.status === 0 && request.responseType !== 'opaque'
}

function isServerError(request) {
  return request.status >= 500
}

function truncateResponse(response, configuration) {
  if (
    response &&
    response.length > configuration.requestErrorResponseLengthLimit
  ) {
    return (
      response.substring(0, configuration.requestErrorResponseLengthLimit) +
      '...'
    )
  }
  return response
}

function format(type) {
  if (RequestType.XHR === type) {
    return 'XHR'
  }
  return 'Fetch'
}
