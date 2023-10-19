import {
  elapsed,
  find,
  LifeCycleEventType,
  isElementNode
} from '@cloudcare/browser-core'
import { getSelectorFromElement } from '../actions/getSelectorsFromElement'

/**
 * Track the first input occurring during the initial View to return:
 * - First Input Delay
 * - First Input Time
 * Callback is called at most one time.
 * Documentation: https://web.dev/fid/
 * Reference implementation: https://github.com/GoogleChrome/web-vitals/blob/master/src/getFID.ts
 */
export function trackFirstInput(
  lifeCycle,
  configuration,
  firstHidden,
  callback
) {
  var subscribe = lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
    function (entries) {
      var firstInputEntry = find(entries, function (entry) {
        return (
          entry.entryType === 'first-input' &&
          entry.startTime < firstHidden.geTimeStamp()
        )
      })
      if (firstInputEntry) {
        var firstInputDelay = elapsed(
          firstInputEntry.startTime,
          firstInputEntry.processingStart
        )
        var firstInputTargetSelector
        if (firstInputEntry.target && isElementNode(firstInputEntry.target)) {
          firstInputTargetSelector = getSelectorFromElement(
            firstInputEntry.target,
            configuration.actionNameAttribute
          )
        }
        callback({
          // Ensure firstInputDelay to be positive, see
          // https://bugs.chromium.org/p/chromium/issues/detail?id=1185815
          delay: firstInputDelay >= 0 ? firstInputDelay : 0,
          time: firstInputEntry.startTime,
          targetSelector: firstInputTargetSelector
        })
      }
    }
  )
  return {
    stop: subscribe.unsubscribe
  }
}
