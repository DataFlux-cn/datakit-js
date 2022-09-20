import { each, timeStampNow, clocksNow, elapsed } from './helper/tools'
import { computeStackTrace } from './tracekit'
import { toStackTraceString } from './helper/errorTools'
import { normalizeUrl } from './helper/urlPolyfill'
var fetchProxySingleton
var originalFetch
var beforeSendCallbacks = []
var onRequestCompleteCallbacks = []

export function startFetchProxy() {
  if (!fetchProxySingleton) {
    proxyFetch()
    fetchProxySingleton = {
      beforeSend: function (callback) {
        beforeSendCallbacks.push(callback)
      },
      onRequestComplete: function (callback) {
        onRequestCompleteCallbacks.push(callback)
      }
    }
  }
  return fetchProxySingleton
}

export function resetFetchProxy() {
  if (fetchProxySingleton) {
    fetchProxySingleton = undefined
    beforeSendCallbacks.splice(0, beforeSendCallbacks.length)
    onRequestCompleteCallbacks.splice(0, onRequestCompleteCallbacks.length)
    window.fetch = originalFetch
  }
}
function proxyFetch() {
  if (!window.fetch) {
    return
  }

  originalFetch = window.fetch

  window.fetch = function (input, init) {
    var responsePromise
    var context = beforeSend.apply(null, [input, init])
    if (context) {
      responsePromise = originalFetch.call(this, context.input, context.init)
      afterSend.apply(null, [responsePromise, context])
    } else {
      responsePromise = originalFetch.call(this, input, init)
    }

    return responsePromise
  }
}

function beforeSend(input, init) {
  var method =
    (init && init.method) ||
    (typeof input === 'object' && input.method) ||
    'GET'
  var url = normalizeUrl((typeof input === 'object' && input.url) || input)
  var startClocks = clocksNow()

  var context = {
    init: init,
    input: input,
    method: method,
    startClocks: startClocks,
    url: url
  }
  each(beforeSendCallbacks, function (callback) {
    callback(context)
  })

  return context
}

function afterSend(responsePromise, context) {
  var reportFetch = async function (response) {
    context.duration = elapsed(context.startClocks.timeStamp, timeStampNow())

    if ('stack' in response || response instanceof Error) {
      context.status = 0
      context.response = toStackTraceString(computeStackTrace(response))
      context.headers = response.headers
      context.isAborted =
        response instanceof DOMException &&
        response.code === DOMException.ABORT_ERR
      each(onRequestCompleteCallbacks, function (callback) {
        callback(context)
      })
    } else if ('status' in response) {
      var text
      try {
        text = await response.clone().text()
      } catch (e) {
        text = 'Unable to retrieve response: ' + e
      }
      context.response = text
      context.responseType = response.type
      context.status = response.status
      context.headers = response.headers
      context.isAborted = false
      each(onRequestCompleteCallbacks, function (callback) {
        callback(context)
      })
    }
  }
  responsePromise.then(reportFetch, reportFetch)
}
