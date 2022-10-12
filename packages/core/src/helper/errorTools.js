import { each , noop, jsonStringify} from './tools'
import { computeStackTrace} from '../tracekit'

export var ErrorSource = {
  AGENT: 'agent',
  CONSOLE: 'console',
  NETWORK: 'network',
  SOURCE: 'source',
  LOGGER: 'logger',
  CUSTOM: 'custom'
}

export function formatUnknownError(stackTrace, errorObject, nonErrorPrefix,handlingStack) {
  if (
    !stackTrace ||
    (stackTrace.message === undefined && !(errorObject instanceof Error))
  ) {
    return {
      message: nonErrorPrefix + '' + jsonStringify(errorObject),
      stack: 'No stack, consider using an instance of Error',
      handlingStack:handlingStack,
      type: stackTrace && stackTrace.name
    }
  }
  return {
    message: stackTrace.message || 'Empty message',
    stack: toStackTraceString(stackTrace),
    handlingStack:handlingStack,
    type: stackTrace.name
  }
}
/**
 Creates a stacktrace without SDK internal frames.
 
 Constraints:
 - Has to be called at the utmost position of the call stack.
 - No internal monitoring should encapsulate the function, that is why we need to use callMonitored inside of it.
 */
 export function createHandlingStack() {
  /**
   * Skip the two internal frames:
   * - SDK API (console.error, ...)
   * - this function
   * in order to keep only the user calls
   */
  var internalFramesToSkip = 2
  var error = new Error()
  var formattedStack

  // IE needs to throw the error to fill in the stack trace
  if (!error.stack) {
    try {
      throw error
    } catch (e) {
      noop()
    }
  }

  var stackTrace = computeStackTrace(error)
  stackTrace.stack = stackTrace.stack.slice(internalFramesToSkip)
  formattedStack = toStackTraceString(stackTrace)

  return formattedStack
}
export function toStackTraceString(stack) {
  var result = formatErrorMessage(stack)
  each(stack.stack, function (frame) {
    var func = frame.func === '?' ? '<anonymous>' : frame.func
    var args =
      frame.args && frame.args.length > 0
        ? '(' + frame.args.join(', ') + ')'
        : ''
    var line = frame.line ? ':' + frame.line : ''
    var column = frame.line && frame.column ? ':' + frame.column : ''
    result += '\n  at ' + func + args + ' @ ' + frame.url + line + column
  })
  return result
}
export function formatErrorMessage(stack) {
  return (stack.name || 'Error') + ': ' + stack.message
}
export function getFileFromStackTraceString(stack) {
  var execResult = /@ (.+)/.exec(stack)
  return execResult && execResult[1]
}
