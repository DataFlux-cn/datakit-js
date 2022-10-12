import { computeStackTrace } from '../tracekit'
import { createHandlingStack, formatErrorMessage, toStackTraceString } from '../helper/errorTools'
import { mergeObservables, Observable } from '../helper/observable'
import { find, jsonStringify, map } from '../helper/tools'
import { ConsoleApiName } from '../helper/display'


var consoleObservablesByApi = {}

export function initConsoleObservable(apis) {
  var consoleObservables = map(apis, function(api) {
    if (!consoleObservablesByApi[api]) {
      consoleObservablesByApi[api] = createConsoleObservable(api)
    }
    return consoleObservablesByApi[api]
  })

  return mergeObservables.apply(this, consoleObservables)
}

/* eslint-disable no-console */
function createConsoleObservable(api) {
  var observable = new Observable(function(){
    var originalConsoleApi = console[api]
    console[api] = function() {
      var params = [].slice.call(arguments)
      originalConsoleApi.apply(console, arguments)
      var handlingStack = createHandlingStack()
      observable.notify(buildConsoleLog(params, api, handlingStack))
    }
    return function() {
      console[api] = originalConsoleApi
    }
  })
  return observable
}

function buildConsoleLog(params, api, handlingStack) {
  // Todo: remove console error prefix in the next major version
  var message = map(params, function(param) { return formatConsoleParameters(param) }).join(' ')
  var stack

  if (api === ConsoleApiName.error) {
    var firstErrorParam = find(params, function(param) { return param instanceof Error })
    stack = firstErrorParam ? toStackTraceString(computeStackTrace(firstErrorParam)) : undefined
    message = 'console error: '+ message
  }

  return {
    api: api,
    message: message,
    stack: stack,
    handlingStack: handlingStack,
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
