import { newRetryState, sendWithRetryStrategy } from './sendWithRetryStrategy'
import { addEventListener } from '../browser/addEventListener'
import { monitor } from '../helper/monitor'
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
export function createHttpRequest(
  endpointUrl,
  bytesLimit,
  sendContentTypeByJson,
  reportError
) {
  var contentType = sendContentTypeByJson
    ? 'application/json; charset=UTF-8'
    : undefined
  var retryState = newRetryState()
  var sendStrategyForRetry = function (payload, onResponse) {
    return fetchKeepAliveStrategy(
      endpointUrl,
      bytesLimit,
      contentType,
      payload,
      onResponse
    )
  }

  return {
    send: function (payload) {
      sendWithRetryStrategy(
        payload,
        retryState,
        sendStrategyForRetry,
        endpointUrl,
        reportError
      )
    },
    /**
     * Since fetch keepalive behaves like regular fetch on Firefox,
     * keep using sendBeaconStrategy on exit
     */
    sendOnExit: function (payload) {
      sendBeaconStrategy(endpointUrl, bytesLimit, contentType, payload)
    }
  }
}

function sendBeaconStrategy(endpointUrl, bytesLimit, contentType, payload) {
  var data = payload.data
  var bytesCount = payload.bytesCount
  var url = addBatchPrecision(endpointUrl)
  var canUseBeacon = !!navigator.sendBeacon && bytesCount < bytesLimit
  if (canUseBeacon) {
    try {
      var beaconData
      if (contentType) {
        beaconData = new Blob([data], {
          type: contentType
        })
      } else {
        beaconData = data
      }

      var isQueued = navigator.sendBeacon(url, beaconData)

      if (isQueued) {
        return
      }
    } catch (e) {
      // reportBeaconError(e)
    }
  }
  sendXHR(url, contentType, data)
}

export function fetchKeepAliveStrategy(
  endpointUrl,
  bytesLimit,
  contentType,
  payload,
  onResponse
) {
  var data = payload.data
  var bytesCount = payload.bytesCount
  var url = addBatchPrecision(endpointUrl)
  var canUseKeepAlive = isKeepAliveSupported() && bytesCount < bytesLimit
  if (canUseKeepAlive) {
    var fetchOption = {
      method: 'POST',
      body: data,
      keepalive: true,
      mode: 'cors'
    }
    if (contentType) {
      fetchOption.headers = {
        'Content-Type': contentType
      }
    }
    fetch(url, fetchOption).then(
      monitor(function (response) {
        if (typeof onResponse === 'function') {
          onResponse({ status: response.status, type: response.type })
        }
      }),
      monitor(function () {
        // failed to queue the request
        sendXHR(url, contentType, data, onResponse)
      })
    )
  } else {
    sendXHR(url, contentType, data, onResponse)
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

function sendXHR(url, contentType, data, onResponse) {
  const request = new XMLHttpRequest()
  request.open('POST', url, true)
  if (contentType) {
    //application/json; charset=UTF-8
    request.setRequestHeader('Content-Type', contentType)
  }

  addEventListener(
    request,
    'loadend',
    function () {
      if (typeof onResponse === 'function') {
        onResponse({ status: request.status })
      }
    },
    {
      once: true
    }
  )
  request.send(data)
}
