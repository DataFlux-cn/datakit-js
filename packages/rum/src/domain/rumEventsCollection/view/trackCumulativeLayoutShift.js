import {
  find,
  noop,
  round,
  ONE_SECOND,
  LifeCycleEventType,
  isElementNode
} from '@cloudcare/browser-core'
import { supportPerformanceTimingEvent } from '../../performanceCollection'
import { getSelectorFromElement } from '../actions/getSelectorsFromElement'

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
export function trackCumulativeLayoutShift(lifeCycle, configuration, callback) {
  if (!isLayoutShiftSupported()) {
    return {
      stop: noop
    }
  }
  var maxClsValue = 0
  callback({
    value: 0
  })
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
            var cls = round(maxClsValue, 4)
            var clsTarget = window.largestLayoutShiftTarget()
            var cslTargetSelector
            if (
              clsTarget &&
              // 检测目标是否在dom 中被删除
              clsTarget.isConnected
            ) {
              cslTargetSelector = getSelectorFromElement(
                clsTarget,
                configuration.actionNameAttribute
              )
            }
            callback({
              value: cls,
              targetSelector: cslTargetSelector
            })
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
  var largestLayoutShift = 0
  var largestLayoutShiftTarget
  var largestLayoutShiftTime
  return {
    update: function (entry) {
      var shouldCreateNewWindow =
        startTime === undefined ||
        entry.startTime - endTime >= ONE_SECOND ||
        entry.startTime - startTime >= 5 * ONE_SECOND
      if (shouldCreateNewWindow) {
        startTime = endTime = entry.startTime
        value = entry.value
        largestLayoutShift = 0
        largestLayoutShiftTarget = undefined
      } else {
        value += entry.value
        endTime = entry.startTime
      }

      if (entry.value > largestLayoutShift) {
        largestLayoutShift = entry.value
        largestLayoutShiftTime = entry.startTime

        if (entry.sources && entry.sources.length) {
          var findTarget = find(entry.sources, function (s) {
            return !!s.node && isElementNode(s.node)
          })
          if (findTarget) {
            largestLayoutShiftTarget = findTarget.node
          }
        } else {
          largestLayoutShiftTarget = undefined
        }
      }
    },
    value: function () {
      return value
    },
    largestLayoutShiftTarget: function () {
      return largestLayoutShiftTarget
    },
    largestLayoutShiftTime: function () {
      return largestLayoutShiftTime
    }
  }
}

/**
 * Check whether `layout-shift` is supported by the browser.
 */
export function isLayoutShiftSupported() {
  return supportPerformanceTimingEvent('layout-shift')
}
