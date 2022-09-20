import { normalizeUrl } from './helper/urlPolyfill'
import { each, relativeNow, clocksNow, elapsed, extend, timeStampNow } from './helper/tools'

var xhrProxySingleton
var beforeSendCallbacks = []
var onRequestCompleteCallbacks = []
var originalXhrOpen
var originalXhrSend
var originalXhrAbort
export function startXhrProxy() {
  if (!xhrProxySingleton) {
    proxyXhr()
    xhrProxySingleton = {
      beforeSend: function (callback) {
        beforeSendCallbacks.push(callback)
      },
      onRequestComplete: function (callback) {
        onRequestCompleteCallbacks.push(callback)
      }
    }
  }
  return xhrProxySingleton
}

export function resetXhrProxy() {
  if (xhrProxySingleton) {
    xhrProxySingleton = undefined
    beforeSendCallbacks.length = 0
    onRequestCompleteCallbacks.length = 0
    XMLHttpRequest.prototype.open = originalXhrOpen
    XMLHttpRequest.prototype.send = originalXhrSend
    XMLHttpRequest.prototype.abort = originalXhrAbort
  }
}

function proxyXhr() {
  originalXhrOpen = XMLHttpRequest.prototype.open
  originalXhrSend = XMLHttpRequest.prototype.send
  originalXhrAbort = XMLHttpRequest.prototype.abort
  XMLHttpRequest.prototype.open = function (method, url) {
    // WARN: since this data structure is tied to the instance, it is shared by both logs and rum
    // and can be used by different code versions depending on customer setup
    // so it should stay compatible with older versions
    this._dataflux_xhr = {
      method: method,
      startTime: -1, // computed in send call
      url: normalizeUrl(url)
    }
    return originalXhrOpen.apply(this, arguments)
  }

  XMLHttpRequest.prototype.send = function (body) {
    var _this = this
    if (this._dataflux_xhr) {
      var xhrPendingContext = this._dataflux_xhr
      xhrPendingContext.startTime = relativeNow()
      xhrPendingContext.startClocks = clocksNow()
      xhrPendingContext.isAborted = false

      var originalOnreadystatechange = this.onreadystatechange

      this.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE) {
          reportXhr()
        }

        if (originalOnreadystatechange) {
          originalOnreadystatechange.apply(this, arguments)
        }
      }

      var hasBeenReported = false
      var reportXhr = function () {
        _this.removeEventListener('loadend', reportXhr)
        if (hasBeenReported) {
          return
        }
        hasBeenReported = true
        var xhrCompleteContext = extend({}, xhrPendingContext, {
          duration: elapsed(
            xhrPendingContext.startClocks.timeStamp,
            timeStampNow()
          ),
          response: _this.response,
          status: _this.status
        })
        each(onRequestCompleteCallbacks, function (callback) {
          callback(xhrCompleteContext, _this)
        })
      }

      _this.addEventListener('loadend', reportXhr)
      each(beforeSendCallbacks, function (callback) {
        callback(xhrPendingContext, _this)
      })
    }

    return originalXhrSend.apply(_this, arguments)
  }
  XMLHttpRequest.prototype.abort = function () {
    if (this._dataflux_xhr) {
      this._dataflux_xhr.isAborted = true
    }
    return originalXhrAbort.apply(this, arguments)
  }
}
