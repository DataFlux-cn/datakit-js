import { each } from '../helper/tools'
import { getZoneJsOriginalValue } from '../helper/getZoneJsOriginalValue'
export function addEventListener(eventTarget, event, listener, options) {
  return addEventListeners(eventTarget, [event], listener, options)
}

/**
 * Add event listeners to an event emitter object (Window, Element, mock object...).  This provides
 * a few conveniences compared to using `element.addEventListener` directly:
 *
 * * supports IE11 by:
 *   * using an option object only if needed
 *   * emulating the `once` option
 *
 * * wraps the listener with a `monitor` function
 *
 * * returns a `stop` function to remove the listener
 *
 * * with `once: true`, the listener will be called at most once, even if different events are
 *   listened
 */

export function addEventListeners(eventTarget, events, listener, options) {
  var wrappedListener =
    options && options.once
      ? function (event) {
          stop()
          listener(event)
        }
      : listener

  options =
    options && options.passive
      ? { capture: options.capture, passive: options.passive }
      : options && options.capture
  var add = getZoneJsOriginalValue(eventTarget, 'addEventListener')

  each(events, function (event) {
    add.call(eventTarget, event, wrappedListener, options)
  })
  var stop = function () {
    var remove = getZoneJsOriginalValue(eventTarget, 'removeEventListener')
    each(events, function (event) {
      remove.call(eventTarget, event, wrappedListener, options)
    })
  }
  return {
    stop: stop
  }
}
