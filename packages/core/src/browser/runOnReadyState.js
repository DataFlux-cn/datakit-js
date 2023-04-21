import { addEventListener } from './addEventListener'
import { DOM_EVENT } from '../helper/enums'
export function runOnReadyState(expectedReadyState, callback) {
  if (
    document.readyState === expectedReadyState ||
    document.readyState === 'complete'
  ) {
    callback()
  } else {
    var eventName =
      expectedReadyState === 'complete'
        ? DOM_EVENT.LOAD
        : DOM_EVENT.DOM_CONTENT_LOADED
    addEventListener(window, eventName, callback, { once: true })
  }
}
