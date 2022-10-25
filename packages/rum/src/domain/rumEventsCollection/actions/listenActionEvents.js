import { addEventListener, DOM_EVENT, each } from '@cloudcare/browser-core'

export function listenActionEvents(events) {
  var onClick = events.onClick
  var onPointerDown = events.onPointerDown
  var hasSelectionChanged = false
  var selectionEmptyAtPointerDown
  var hasInputChanged = false
  var clickContext
  var listeners = [
    addEventListener(
      window,
      DOM_EVENT.POINTER_DOWN,
      function (event) {
        hasSelectionChanged = false
        selectionEmptyAtPointerDown = isSelectionEmpty()
        if (isMouseEventOnElement(event)) {
          clickContext = onPointerDown(event)
        }
      },
      { capture: true }
    ),

    addEventListener(
      window,
      DOM_EVENT.SELECTION_CHANGE,
      function () {
        if (!selectionEmptyAtPointerDown || !isSelectionEmpty()) {
          hasSelectionChanged = true
        }
      },
      { capture: true }
    ),

    addEventListener(
      window,
      DOM_EVENT.CLICK,
      function (clickEvent) {
        if (isMouseEventOnElement(clickEvent) && clickContext) {
          // Use a scoped variable to make sure the value is not changed by other clicks
          var userActivity = {
            selection: hasSelectionChanged,
            input: hasInputChanged
          }

          if (!hasInputChanged) {
            setTimeout(function () {
              userActivity.input = hasInputChanged
            })
          }
          onClick(clickContext, clickEvent, function () {
            return userActivity
          })
          clickContext = undefined
        }
      },
      { capture: true }
    ),

    addEventListener(
      window,
      DOM_EVENT.INPUT,
      function () {
        hasInputChanged = true
      },
      { capture: true }
    )
  ]

  return {
    stop: function () {
      each(listeners, function (listener) {
        return listener.stop()
      })
    }
  }
}

function isSelectionEmpty() {
  var selection = window.getSelection()
  return !selection || selection.isCollapsed
}
function isMouseEventOnElement(event) {
  return event.target instanceof Element
}
