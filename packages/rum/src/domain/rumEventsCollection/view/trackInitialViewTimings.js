import { setTimeout, assign, ONE_MINUTE } from '@cloudcare/browser-core'
import { trackFirstContentfulPaint } from './trackFirstContentfulPaint'
import { trackFirstInputTimings } from './trackFirstInputTimings'
import { trackNavigationTimings } from './trackNavigationTimings'
import { trackLargestContentfulPaint } from './trackLargestContentfulPaint'
import { getSelectorFromElement } from '../actions/getSelectorsFromElement'

export var KEEP_TRACKING_TIMINGS_AFTER_VIEW_DELAY = 5 * ONE_MINUTE
export function trackInitialViewMetrics(
  lifeCycle,
  setLoadEvent,
  scheduleViewUpdate
) {
  var initialViewMetrics = {}
  function setMetrics(newMetrics) {
    assign(initialViewMetrics, newMetrics)
    scheduleViewUpdate()
  }

  var _trackNavigationTimings = trackNavigationTimings(
    lifeCycle,
    function (navigationTimings) {
      setLoadEvent(navigationTimings.loadEvent)
      setMetrics(navigationTimings)
    }
  )
  var stopNavigationTracking = _trackNavigationTimings.stop
  var _trackFirstContentfulPaint = trackFirstContentfulPaint(
    lifeCycle,
    function (firstContentfulPaint) {
      setMetrics({ firstContentfulPaint: firstContentfulPaint })
    }
  )
  var stopFCPTracking = _trackFirstContentfulPaint.stop
  var _trackLargestContentfulPaint = trackLargestContentfulPaint(
    lifeCycle,
    window,
    function (largestContentfulPaint, lcpElement) {
      setMetrics({
        largestContentfulPaint: largestContentfulPaint,
        largestContentfulPaintElement: lcpElement
          ? getSelectorFromElement(lcpElement)
          : undefined
      })
    }
  )
  var stopLCPTracking = _trackLargestContentfulPaint.stop
  var _trackFirstInputTimings = trackFirstInputTimings(
    lifeCycle,
    function (firttime) {
      setMetrics({
        firstInputDelay: firttime.firstInputDelay,
        firstInputTime: firttime.firstInputTime
      })
    }
  )
  var stopFIDTracking = _trackFirstInputTimings.stop
  function stop() {
    stopNavigationTracking()
    stopFCPTracking()
    stopLCPTracking()
    stopFIDTracking()
  }

  return {
    stop: stop,
    initialViewMetrics: initialViewMetrics,
    scheduleStop: function () {
      setTimeout(stop, KEEP_TRACKING_TIMINGS_AFTER_VIEW_DELAY)
    }
  }
}
