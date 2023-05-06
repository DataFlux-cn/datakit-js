import { DOM_EVENT, addEventListeners } from '@cloudcare/browser-core'
var trackFirstHiddenSingleton
var stopListeners

export function trackFirstHidden(eventTarget) {
  if (typeof eventTarget === 'undefined') {
    eventTarget = window
  }
  if (!trackFirstHiddenSingleton) {
    if (document.visibilityState === 'hidden') {
      trackFirstHiddenSingleton = { timeStamp: 0 }
    } else {
      trackFirstHiddenSingleton = {
        timeStamp: Infinity
      }
      var listeners = addEventListeners(
        eventTarget,
        [DOM_EVENT.PAGE_HIDE, DOM_EVENT.VISIBILITY_CHANGE],
        function (event) {
          if (
            event.type === 'pagehide' ||
            document.visibilityState === 'hidden'
          ) {
            trackFirstHiddenSingleton.timeStamp = event.timeStamp
            stopListeners()
          }
        },
        { capture: true }
      )
      var stopListeners = listeners.stop
    }
  }

  return trackFirstHiddenSingleton
}

export function resetFirstHidden() {
  if (stopListeners) {
    stopListeners()
  }
  trackFirstHiddenSingleton = undefined
}
