import { noop, Observable } from '@cloudcare/browser-core'

export function createDOMMutationObservable() {
  var MutationObserver = getMutationObserverConstructor()

  var observable = new Observable(function () {
    if (!MutationObserver) {
      return
    }
    var observer = new MutationObserver(function () {
      return observable.notify()
    })
    observer.observe(document, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    })
    return function () {
      return observer.disconnect()
    }
  })
  return observable
}

export function getMutationObserverConstructor() {
  var constructor
  var browserWindow = window

  // Angular uses Zone.js to provide a context persisting across async tasks.  Zone.js replaces the
  // global MutationObserver constructor with a patched version to support the context propagation.
  // There is an ongoing issue[1][2] with this setup when using a MutationObserver within a Angular
  // component: on some occasions, the callback is being called in an infinite loop, causing the
  // page to freeze (even if the callback is completely empty).
  //
  // To work around this issue, we try to get the original MutationObserver constructor stored by
  // Zone.js.
  //
  // [1] https://github.com/angular/angular/issues/26948
  // [2] https://github.com/angular/angular/issues/31712
  if (browserWindow.Zone) {
    var zoneSymbol = browserWindow.Zone.__symbol__

    // Zone.js 0.8.6+ is storing original class constructors into the browser 'window' object[3].
    //
    // [3] https://github.com/angular/angular/blob/6375fa79875c0fe7b815efc45940a6e6f5c9c9eb/packages/zone.js/lib/common/utils.ts#L288
    constructor = browserWindow[zoneSymbol('MutationObserver')]

    if (!constructor && browserWindow.MutationObserver) {
      // Anterior Zone.js versions (used in Angular 2) does not expose the original MutationObserver
      // in the 'window' object. Luckily, the patched MutationObserver class is storing an original
      // instance in its properties[4]. Let's get the original MutationObserver constructor from
      // there.
      //
      // [4] https://github.com/angular/zone.js/blob/v0.8.5/lib/common/utils.ts#L412

      var patchedInstance = new browserWindow.MutationObserver(noop)
      var originalInstance = patchedInstance[zoneSymbol('originalInstance')]

      constructor = originalInstance && originalInstance.constructor
    }
  }

  if (!constructor) {
    constructor = browserWindow.MutationObserver
  }

  return constructor
}
