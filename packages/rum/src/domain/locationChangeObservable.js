import {
  addEventListener,
  DOM_EVENT,
  Observable,
  shallowClone,
} from '@cloudcare/browser-core'

export function createLocationChangeObservable(location) {
  var currentLocation = shallowClone(location)
  var observable = new Observable(function(){
    var _trackHistory = trackHistory(onLocationChange)
    var _trackHash = trackHash(onLocationChange)
    return function() {
      _trackHistory.stop()
      _trackHash.stop()
    }
  })

  function onLocationChange() {
    if (currentLocation.href === location.href) {
      return
    }
    var newLocation = shallowClone(location)
    observable.notify({
      newLocation: newLocation,
      oldLocation: currentLocation,
    })
    currentLocation = newLocation
  }

  return observable
}

function trackHistory(onHistoryChange) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  var originalPushState = history.pushState
  history.pushState = function () {
    originalPushState.apply(this, arguments)
    onHistoryChange()
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  var originalReplaceState = history.replaceState
  history.replaceState = function () {
    originalReplaceState.apply(this, arguments)
    onHistoryChange()
  }
  var _addEventListener = addEventListener(
    window,
    DOM_EVENT.POP_STATE,
    onHistoryChange
  )
  var removeListener = _addEventListener.stop

  var stop = function () {
    removeListener()
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
  }
  return { stop: stop }
}

function trackHash(onHashChange) {
  return addEventListener(window, DOM_EVENT.HASH_CHANGE, onHashChange)
}
