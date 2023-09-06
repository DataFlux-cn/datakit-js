import {
  getViewportDimension,
  initViewportObservable
} from '../initViewportObservable'

var viewport
var stopListeners

export function getDisplayContext() {
  if (!viewport) {
    viewport = getViewportDimension()
    stopListeners = initViewportObservable().subscribe(function (
      viewportDimension
    ) {
      viewport = viewportDimension
    }).unsubscribe
  }

  return {
    viewport: viewport
  }
}

export function resetDisplayContext() {
  if (stopListeners) {
    stopListeners()
  }
  viewport = undefined
}
