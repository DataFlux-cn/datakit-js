import {
  addEventListener,
  DOM_EVENT,
  Observable,
  shallowClone,
  instrumentMethodAndCallOriginal
} from '@cloudcare/browser-core'

export function createLocationChangeObservable(location) {
  var currentLocation = shallowClone(location)
  return new Observable(function (observable) {
    var _trackHistory = trackHistory(onLocationChange)
    var _trackHash = trackHash(onLocationChange)
    function onLocationChange() {
      if (currentLocation.href === location.href) {
        return
      }
      var newLocation = shallowClone(location)
      observable.notify({
        newLocation: newLocation,
        oldLocation: currentLocation
      })
      currentLocation = newLocation
    }
    return function () {
      _trackHistory.stop()
      _trackHash.stop()
    }
  })
}

function trackHistory(onHistoryChange) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  var pushState = instrumentMethodAndCallOriginal(history, 'pushState', {
    after: onHistoryChange
  })
  var replaceState = instrumentMethodAndCallOriginal(history, 'replaceState', {
    after: onHistoryChange
  })
  var popState = addEventListener(window, DOM_EVENT.POP_STATE, onHistoryChange)

  return {
    stop: function () {
      pushState.stop()
      replaceState.stop()
      popState.stop()
    }
  }
}

function trackHash(onHashChange) {
  return addEventListener(window, DOM_EVENT.HASH_CHANGE, onHashChange)
}
