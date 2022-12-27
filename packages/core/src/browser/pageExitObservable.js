import { Observable } from '../helper/observable'
import { addEventListener } from '../helper/tools'
import { DOM_EVENT } from '../helper/enums'
export var PageExitReason = {
  HIDDEN: 'visibility_hidden',
  UNLOADING: 'before_unload'
}

export function createPageExitObservable() {
  var observable = new Observable(function () {
    /**
     * Only event that guarantee to fire on mobile devices when the page transitions to background state
     * (e.g. when user switches to a different application, goes to homescreen, etc), or is being unloaded.
     */
    var visibilityChangeListener = addEventListener(
      document,
      DOM_EVENT.VISIBILITY_CHANGE,
      function () {
        if (document.visibilityState === 'hidden') {
          observable.notify({ reason: PageExitReason.HIDDEN })
        }
      },
      { capture: true }
    )

    /**
     * Safari does not support yet to send a request during:
     * - a visibility change during doc unload (cf: https://bugs.webkit.org/show_bug.cgi?id=194897)
     * - a page hide transition (cf: https://bugs.webkit.org/show_bug.cgi?id=188329)
     */
    var beforeUnloadListener = addEventListener(
      window,
      DOM_EVENT.BEFORE_UNLOAD,
      function () {
        observable.notify({ reason: PageExitReason.UNLOADING })
      }
    )

    return function () {
      visibilityChangeListener.stop()
      beforeUnloadListener.stop()
    }
  })

  return observable
}
