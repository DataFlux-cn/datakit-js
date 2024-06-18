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
  // WeakRef is not supported in IE11 and Safari mobile, but so is the layout shift API, so this code won't be executed in these browsers
  var maxClsTarget

  // if no layout shift happen the value should be reported as 0
  callback({
    value: 0
  })

  var window = slidingSessionWindow()
  var _subscribe = lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
    (entries) => {
      for (var entry of entries) {
        if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
          var _update = window.update(entry)
          var cumulatedValue = _update.cumulatedValue
          var isMaxValue = _update.isMaxValue
          if (isMaxValue) {
            var target = getTargetFromSource(entry.sources)
            maxClsTarget = target ? new WeakRef(target) : undefined
          }

          if (cumulatedValue > maxClsValue) {
            maxClsValue = cumulatedValue
            var target = maxClsTarget && maxClsTarget.deref()

            callback({
              value: round(maxClsValue, 4),
              targetSelector:
                target &&
                getSelectorFromElement(
                  target,
                  configuration.actionNameAttribute
                )
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
function getTargetFromSource(sources) {
  if (!sources) {
    return
  }
  var source = find(sources, function (source) {
    return !!source.node && isElementNode(source.node)
  })
  return source && source.node
}
export var MAX_WINDOW_DURATION = 5 * ONE_SECOND
var MAX_UPDATE_GAP = ONE_SECOND
function slidingSessionWindow() {
  var cumulatedValue = 0
  var startTime
  var endTime
  var maxValue = 0
  return {
    update: function (entry) {
      var shouldCreateNewWindow =
        startTime === undefined ||
        entry.startTime - endTime >= MAX_UPDATE_GAP ||
        entry.startTime - startTime >= 5 * MAX_WINDOW_DURATION
      var isMaxValue

      if (shouldCreateNewWindow) {
        startTime = endTime = entry.startTime
        maxValue = cumulatedValue = entry.value
        isMaxValue = true
      } else {
        cumulatedValue += entry.value
        endTime = entry.startTime
        isMaxValue = entry.value > maxValue
        if (isMaxValue) {
          maxValue = entry.value
        }
      }
      return {
        cumulatedValue: cumulatedValue,
        isMaxValue: isMaxValue
      }
    }
  }
}

/**
 * Check whether `layout-shift` is supported by the browser.
 */
export function isLayoutShiftSupported() {
  return supportPerformanceTimingEvent('layout-shift')
}
