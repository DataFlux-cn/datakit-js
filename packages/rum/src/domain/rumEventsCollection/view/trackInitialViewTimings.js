import { ONE_MINUTE } from '@cloudcare/browser-core'
import { trackFirstContentfulPaint } from './trackFirstContentfulPaint'
import { trackFirstInput } from './trackFirstInput'
import { trackNavigationTimings } from './trackNavigationTimings'
import { trackLargestContentfulPaint } from './trackLargestContentfulPaint'
import { trackFirstHidden } from './trackFirstHidden'

export var KEEP_TRACKING_TIMINGS_AFTER_VIEW_DELAY = 5 * ONE_MINUTE
export function trackInitialViewMetrics(
  lifeCycle,
  configuration,
  setLoadEvent,
  scheduleViewUpdate
) {
  var initialViewMetrics = {}
  var _trackNavigationTimings = trackNavigationTimings(
    lifeCycle,
    function (navigationTimings) {
      setLoadEvent(navigationTimings.loadEvent)
      initialViewMetrics.navigationTimings = navigationTimings
      scheduleViewUpdate()
    }
  )
  var firstHidden = trackFirstHidden()
  var stopNavigationTracking = _trackNavigationTimings.stop
  var _trackFirstContentfulPaint = trackFirstContentfulPaint(
    lifeCycle,
    firstHidden,
    function (firstContentfulPaint) {
      initialViewMetrics.firstContentfulPaint = firstContentfulPaint
      scheduleViewUpdate()
    }
  )
  var stopFCPTracking = _trackFirstContentfulPaint.stop
  var _trackLargestContentfulPaint = trackLargestContentfulPaint(
    lifeCycle,
    configuration,
    firstHidden,
    window,
    function (largestContentfulPaint) {
      initialViewMetrics.largestContentfulPaint = largestContentfulPaint
      scheduleViewUpdate()
    }
  )
  var stopLCPTracking = _trackLargestContentfulPaint.stop
  var _trackFirstInput = trackFirstInput(
    lifeCycle,
    configuration,
    firstHidden,
    function (firstInput) {
      initialViewMetrics.firstInput = firstInput
      scheduleViewUpdate()
    }
  )
  var stopFIDTracking = _trackFirstInput.stop
  function stop() {
    stopNavigationTracking()
    stopFCPTracking()
    stopLCPTracking()
    stopFIDTracking()
    firstHidden.stop()
  }

  return {
    stop: stop,
    initialViewMetrics: initialViewMetrics
  }
}
