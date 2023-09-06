import { elapsed, find, LifeCycleEventType } from '@cloudcare/browser-core'
import { trackFirstHidden } from './trackFirstHidden'
/**
 * Track the first input occurring during the initial View to return:
 * - First Input Delay
 * - First Input Time
 * Callback is called at most one time.
 * Documentation: https://web.dev/fid/
 * Reference implementation: https://github.com/GoogleChrome/web-vitals/blob/master/src/getFID.ts
 */
export function trackFirstInputTimings(lifeCycle, callback) {
  var firstHidden = trackFirstHidden()
  var subscribe = lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
    function (entries) {
      var firstInputEntry = find(entries, function (entry) {
        return (
          entry.entryType === 'first-input' &&
          entry.startTime < firstHidden.timeStamp
        )
      })
      if (firstInputEntry) {
        var firstInputDelay = elapsed(
          firstInputEntry.startTime,
          firstInputEntry.processingStart
        )
        callback({
          // Ensure firstInputDelay to be positive, see
          // https://bugs.chromium.org/p/chromium/issues/detail?id=1185815
          firstInputDelay: firstInputDelay >= 0 ? firstInputDelay : 0,
          firstInputTime: firstInputEntry.startTime,
          firstInputTarget: firstInputEntry.target
        })
      }
    }
  )
  return {
    stop: subscribe.unsubscribe
  }
}
