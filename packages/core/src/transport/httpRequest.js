import { newRetryState, sendWithRetryStrategy } from './sendWithRetryStrategy'

/**
 * Use POST request without content type to:
 * - avoid CORS preflight requests
 * - allow usage of sendBeacon
 *
 * multiple elements are sent separated by \n in order
 * to be parsed correctly without content type header
 */
function addBatchPrecision(url) {
  if (!url) return url
  return url + (url.indexOf('?') === -1 ? '?' : '&') + 'precision=ms'
}
export function createHttpRequest(endpointUrl, bytesLimit, reportError) {
  var retryState = newRetryState()
  var sendStrategyForRetry = function (payload, onResponse) {
    return fetchKeepAliveStrategy(endpointUrl, bytesLimit, payload, onResponse)
  }

  return {
    send: function (payload) {
      sendWithRetryStrategy(
        payload,
        retryState,
        sendStrategyForRetry,
        reportError
      )
    },
    /**
     * Since fetch keepalive behaves like regular fetch on Firefox,
     * keep using sendBeaconStrategy on exit
     */
    sendOnExit: function (payload) {
      sendBeaconStrategy(endpointUrl, bytesLimit, payload)
    }
  }
}

function sendBeaconStrategy(endpointUrl, bytesLimit, payload) {
  var data = payload.data
  var bytesCount = payload.bytesCount
  var url = addBatchPrecision(endpointUrl)
  var canUseBeacon = !!navigator.sendBeacon && bytesCount < bytesLimit
  if (canUseBeacon) {
    try {
      var isQueued = navigator.sendBeacon(url, data)

      if (isQueued) {
        return
      }
    } catch (e) {
      // reportBeaconError(e)
    }
  }
  sendXHR(url, data)
}

export function fetchKeepAliveStrategy(
  endpointUrl,
  bytesLimit,
  payload,
  onResponse
) {
  var data = payload.data
  var bytesCount = payload.bytesCount
  var url = addBatchPrecision(endpointUrl)
  var canUseKeepAlive = isKeepAliveSupported() && bytesCount < bytesLimit
  if (canUseKeepAlive) {
    fetch(url, {
      method: 'POST',
      body: data,
      keepalive: true,
      mode: 'cors'
    }).then(
      function (response) {
        if (typeof onResponse === 'function') {
          onResponse({ status: response.status, type: response.type })
        }
      },
      function () {
        // failed to queue the request
        sendXHR(url, data, onResponse)
      }
    )
  } else {
    sendXHR(url, data, onResponse)
  }
}

function isKeepAliveSupported() {
  // Request can throw, cf https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#errors
  try {
    return window.Request && 'keepalive' in new Request('http://a')
  } catch {
    return false
  }
}

function sendXHR(url, data, onResponse) {
  const request = new XMLHttpRequest()
  request.open('POST', url, true)
  request.send(data)
  request.addEventListener('loadend', function () {
    if (typeof onResponse === 'function') {
      onResponse({ status: request.status })
    }
  })
}
