import { instrumentMethodAndCallOriginal } from '../helper/instrumentMethod'
import { Observable } from '../helper/observable'
import { normalizeUrl } from '../helper/urlPolyfill'
import {
  shallowClone,
  elapsed,
  relativeNow,
  clocksNow,
  timeStampNow,
  UUID
} from '../helper/tools'
import { addEventListener } from '../browser/addEventListener'
var xhrObservable
var xhrContexts = {}
var DATA_FLUX_REQUEST_ID_KEY = '_DATAFLUX_REQUEST_UUID'
export function initXhrObservable() {
  if (!xhrObservable) {
    xhrObservable = createXhrObservable()
  }
  return xhrObservable
}

function createXhrObservable() {
  return new Observable(function (observable) {
    var openInstrumentMethod = instrumentMethodAndCallOriginal(
      XMLHttpRequest.prototype,
      'open',
      {
        before: openXhr
      }
    )

    var sendInstrumentMethod = instrumentMethodAndCallOriginal(
      XMLHttpRequest.prototype,
      'send',
      {
        before: function () {
          sendXhr.call(this, observable)
        }
      }
    )

    var abortInstrumentMethod = instrumentMethodAndCallOriginal(
      XMLHttpRequest.prototype,
      'abort',
      {
        before: abortXhr
      }
    )

    return function () {
      openInstrumentMethod.stop()
      sendInstrumentMethod.stop()
      abortInstrumentMethod.stop()
    }
  })
}

function openXhr(method, url) {
  var requestUUID = this[DATA_FLUX_REQUEST_ID_KEY] || UUID()
  this[DATA_FLUX_REQUEST_ID_KEY] = requestUUID
  xhrContexts[requestUUID] = {
    state: 'open',
    method: String(method).toUpperCase(),
    url: normalizeUrl(String(url))
  }
}

function sendXhr(observable) {
  var context = xhrContexts[this[DATA_FLUX_REQUEST_ID_KEY]]
  if (!context) {
    return
  }
  var startContext = context
  startContext.state = 'start'
  startContext.startTime = relativeNow()
  startContext.startClocks = clocksNow()
  startContext.isAborted = false
  startContext.xhr = this
  var hasBeenReported = false
  var stopInstrumentingOnReadyStateChange = instrumentMethodAndCallOriginal(
    this,
    'onreadystatechange',
    {
      before: function () {
        if (this.readyState === XMLHttpRequest.DONE) {
          // Try to report the XHR as soon as possible, because the XHR may be mutated by the
          // application during a future event. For example, Angular is calling .abort() on
          // completed requests during a onreadystatechange event, so the status becomes '0'
          // before the request is collected.
          onEnd.call(this)
        }
      }
    }
  ).stop

  var onEnd = function () {
    unsubscribeLoadEndListener()
    stopInstrumentingOnReadyStateChange()
    if (hasBeenReported) {
      return
    }
    hasBeenReported = true
    var completeContext = context
    completeContext.state = 'complete'
    completeContext.duration = elapsed(
      startContext.startClocks.timeStamp,
      timeStampNow()
    )
    completeContext.status = this.status
    observable.notify(shallowClone(completeContext))
    clearRequestId.call(this)
  }
  var unsubscribeLoadEndListener = addEventListener(this, 'loadend', onEnd).stop
  observable.notify(startContext)
}
function clearRequestId() {
  delete xhrContexts[this[DATA_FLUX_REQUEST_ID_KEY]]
  delete this[DATA_FLUX_REQUEST_ID_KEY]
}
function abortXhr() {
  var context = xhrContexts[this[DATA_FLUX_REQUEST_ID_KEY]]
  if (context) {
    context.isAborted = true
  }
}
