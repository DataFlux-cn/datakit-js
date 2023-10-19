import { ConsoleApiName, display } from './display'
var onMonitorErrorCollected
var debugMode = false

export function startMonitorErrorCollection(newOnMonitorErrorCollected) {
  onMonitorErrorCollected = newOnMonitorErrorCollected
}

export function setDebugMode(newDebugMode) {
  debugMode = newDebugMode
}

export function resetMonitor() {
  onMonitorErrorCollected = undefined
  debugMode = false
}

export function monitor(fn) {
  return function () {
    return callMonitored(fn, this, arguments)
  }
}

export function callMonitored(fn, context, args) {
  try {
    return fn.apply(context, args)
  } catch (e) {
    displayIfDebugEnabled(ConsoleApiName.error, e)
    if (onMonitorErrorCollected) {
      try {
        onMonitorErrorCollected(e)
      } catch (e) {
        displayIfDebugEnabled(ConsoleApiName.error, e)
      }
    }
  }
}

export function displayIfDebugEnabled(api) {
  var args = [].slice.call(arguments, 1)
  //   display.apply(null, [api, '[MONITOR]'].concat(args))
  if (debugMode) {
    display.apply(null, [api, '[MONITOR]'].concat(args))
  }
}
