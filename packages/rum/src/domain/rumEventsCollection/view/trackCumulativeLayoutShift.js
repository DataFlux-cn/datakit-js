import { round, ONE_SECOND, LifeCycleEventType } from '@cloudcare/browser-core'
import { supportPerformanceTimingEvent } from '../../performanceCollection'
/**
 * Track the cumulative layout shifts (CLS).
 * Layout shifts are grouped into session windows.
 * The minimum gap between session windows is 1 second.
 * The maximum duration of a session window is 5 second.
 * The session window layout shift value is the sum of layout shifts inside it.
 * The CLS value is the max of session windows values.
 *
 * This yields a new value whenever the CLS value is updated (a higher session window value is computed).
 *
 * See isLayoutShiftSupported to check for browser support.
 *
 * Documentation:
 * https://web.dev/cls/
 * https://web.dev/evolving-cls/
 * Reference implementation: https://github.com/GoogleChrome/web-vitals/blob/master/src/getCLS.ts
 */
export function trackCumulativeLayoutShift(lifeCycle, callback) {
  var maxClsValue = 0
  var window = slidingSessionWindow()
  var _subscribe = lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i]
        if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
          window.update(entry)
          if (window.value() > maxClsValue) {
            maxClsValue = window.value()
            callback(round(maxClsValue, 4))
          }
        }
      }
    }
  )
  var stop = _subscribe.unsubscribe
  return {
    stop: stop
  }
}

function slidingSessionWindow() {
  var value = 0
  var startTime
  var endTime
  return {
    update: function (entry) {
      var shouldCreateNewWindow =
        startTime === undefined ||
        entry.startTime - endTime >= ONE_SECOND ||
        entry.startTime - startTime >= 5 * ONE_SECOND
      if (shouldCreateNewWindow) {
        startTime = endTime = entry.startTime
        value = entry.value
      } else {
        value += entry.value
        endTime = entry.startTime
      }
    },
    value: function () {
      return value
    }
  }
}

/**
 * Check whether `layout-shift` is supported by the browser.
 */
export function isLayoutShiftSupported() {
  return supportPerformanceTimingEvent('layout-shift')
}
