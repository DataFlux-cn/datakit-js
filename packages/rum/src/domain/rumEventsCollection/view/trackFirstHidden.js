import { DOM_EVENT, addEventListeners } from '@cloudcare/browser-core'

export function trackFirstHidden(eventTarget) {
  if (typeof eventTarget === 'undefined') {
    eventTarget = window
  }
  var timeStamp
  var stopListeners
  if (document.visibilityState === 'hidden') {
    timeStamp = 0
  } else {
    timeStamp = Infinity
    var stopListeners = addEventListeners(
      eventTarget,
      [DOM_EVENT.PAGE_HIDE, DOM_EVENT.VISIBILITY_CHANGE],
      function (event) {
        if (
          event.type === DOM_EVENT.PAGE_HIDE ||
          document.visibilityState === 'hidden'
        ) {
          timeStamp = event.timeStamp
          stopListeners()
        }
      },
      { capture: true }
    ).stop
  }

  return {
    geTimeStamp() {
      return timeStamp
    },
    stop: function () {
      stopListeners && stopListeners()
    }
  }
}
