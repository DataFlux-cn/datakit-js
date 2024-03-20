import { computeStackTrace } from '../tracekit'
import {
  createHandlingStack,
  formatErrorMessage,
  toStackTraceString,
  flattenErrorCauses
} from '../helper/errorTools'
import { mergeObservables, Observable } from '../helper/observable'
import { find, map } from '../helper/tools'
import { jsonStringify } from '../helper/serialisation/jsonStringify'
import { ConsoleApiName } from '../helper/display'
import { callMonitored } from '../helper/monitor'
var consoleObservablesByApi = {}

export function initConsoleObservable(apis) {
  var consoleObservables = map(apis, function (api) {
    if (!consoleObservablesByApi[api]) {
      consoleObservablesByApi[api] = createConsoleObservable(api)
    }
    return consoleObservablesByApi[api]
  })

  return mergeObservables.apply(this, consoleObservables)
}

/* eslint-disable no-console */
function createConsoleObservable(api) {
  return new Observable(function (observable) {
    var originalConsoleApi = console[api]
    console[api] = function () {
      var params = [].slice.call(arguments)
      originalConsoleApi.apply(console, arguments)
      var handlingStack = createHandlingStack()
      callMonitored(function () {
        observable.notify(buildConsoleLog(params, api, handlingStack))
      })
    }
    return function () {
      console[api] = originalConsoleApi
    }
  })
}

function buildConsoleLog(params, api, handlingStack) {
  var message = map(params, function (param) {
    return formatConsoleParameters(param)
  }).join(' ')
  var stack
  var causes
  if (api === ConsoleApiName.error) {
    var firstErrorParam = find(params, function (param) {
      return param instanceof Error
    })
    stack = firstErrorParam
      ? toStackTraceString(computeStackTrace(firstErrorParam))
      : undefined
    message = 'console error: ' + message
    causes = firstErrorParam
      ? flattenErrorCauses(firstErrorParam, 'console')
      : undefined
  }

  return {
    api: api,
    message: message,
    stack: stack,
    handlingStack: handlingStack,
    causes: causes
  }
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
