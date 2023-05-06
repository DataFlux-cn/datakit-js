import {
  addEventListeners,
  elapsed,
  extend,
  DOM_EVENT,
  find,
  findLast,
  LifeCycleEventType,
  ONE_MINUTE,
  setTimeout,
  relativeNow
} from '@cloudcare/browser-core'
import { trackFirstHidden } from './trackFirstHidden'
// Discard LCP and FCP timings above a certain delay to avoid incorrect data
// It happens in some cases like sleep mode or some browser implementations
export var TIMING_MAXIMUM_DELAY = 10 * ONE_MINUTE
/**
 * The initial view can finish quickly, before some metrics can be produced (ex: before the page load
 * event, or the first input). Also, we don't want to trigger a view update indefinitely, to avoid
 * updates on views that ended a long time ago. Keep watching for metrics after the view ends for a
 * limited amount of time.
 */
export const KEEP_TRACKING_TIMINGS_AFTER_VIEW_DELAY = 5 * ONE_MINUTE
export function trackInitialViewTimings(
  lifeCycle,
  setLoadEvent,
  scheduleViewUpdate
) {
  var timings = {}
  function setTimings(newTimings) {
    timings = extend(timings, newTimings)
    scheduleViewUpdate()
  }
  var _trackNavigationTimings = trackNavigationTimings(
    lifeCycle,
    function (newTimings) {
      setLoadEvent(newTimings.loadEvent)
      setTimings(newTimings)
    }
  )
  var stopNavigationTracking = _trackNavigationTimings.stop

  var _trackFirstContentfulPaintTiming = trackFirstContentfulPaintTiming(
    lifeCycle,
    function (firstContentfulPaint) {
      setTimings({ firstContentfulPaint: firstContentfulPaint })
    }
  )
  var stopFCPTracking = _trackFirstContentfulPaintTiming.stop
  var _trackLargestContentfulPaintTiming = trackLargestContentfulPaintTiming(
    lifeCycle,
    window,
    function (largestContentfulPaint) {
      setTimings({ largestContentfulPaint: largestContentfulPaint })
    }
  )
  var stopLCPTracking = _trackLargestContentfulPaintTiming.stop
  var _trackFirstInputTimings = trackFirstInputTimings(
    lifeCycle,
    function (firttime) {
      setTimings({
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
    timings: timings,
    scheduleStop: function () {
      setTimeout(stop, KEEP_TRACKING_TIMINGS_AFTER_VIEW_DELAY)
    }
  }
}

export function trackNavigationTimings(lifeCycle, callback) {
  var subscribe = lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i]
        if (entry.entryType === 'navigation') {
          callback({
            fetchStart: entry.fetchStart,
            responseEnd: entry.responseEnd,
            domComplete: entry.domComplete,
            domContentLoaded: entry.domContentLoadedEventEnd,
            domInteractive: entry.domInteractive,
            loadEvent: entry.loadEventEnd,
            loadEventEnd: entry.loadEventEnd,
            loadEventStart: entry.loadEventStart,
            domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
            domContentLoadedEventStart: entry.domContentLoadedEventStart,
            // In some cases the value reported is negative or is larger
            // than the current page time. Ignore these cases:
            // https://github.com/GoogleChrome/web-vitals/issues/137
            // https://github.com/GoogleChrome/web-vitals/issues/162
            firstByte:
              entry.responseStart >= 0 && entry.responseStart <= relativeNow()
                ? entry.responseStart
                : undefined
          })
        }
      }
    }
  )

  return { stop: subscribe.unsubscribe }
}

export function trackFirstContentfulPaintTiming(lifeCycle, callback) {
  var firstHidden = trackFirstHidden()
  var subscribe = lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
    function (entries) {
      var fcpEntry = find(entries, function (entry) {
        return (
          entry.entryType === 'paint' &&
          entry.name === 'first-contentful-paint' &&
          entry.startTime < firstHidden.timeStamp &&
          entry.startTime < TIMING_MAXIMUM_DELAY
        )
      })
      if (fcpEntry) {
        callback(fcpEntry.startTime)
      }
    }
  )
  return { stop: subscribe.unsubscribe }
}

/**
 * Track the largest contentful paint (LCP) occurring during the initial View.  This can yield
 * multiple values, only the most recent one should be used.
 * Documentation: https://web.dev/lcp/
 * Reference implementation: https://github.com/GoogleChrome/web-vitals/blob/master/src/getLCP.ts
 */
export function trackLargestContentfulPaintTiming(
  lifeCycle,
  emitter,
  callback
) {
  var firstHidden = trackFirstHidden()

  // Ignore entries that come after the first user interaction.  According to the documentation, the
  // browser should not send largest-contentful-paint entries after a user interact with the page,
  // but the web-vitals reference implementation uses this as a safeguard.
  var firstInteractionTimestamp = Infinity
  var _addEventListeners = addEventListeners(
    emitter,
    [DOM_EVENT.POINTER_DOWN, DOM_EVENT.KEY_DOWN],
    function (event) {
      firstInteractionTimestamp = event.timeStamp
    },
    { capture: true, once: true }
  )
  var stopEventListener = _addEventListeners.stop
  var subscribe = lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
    function (entries) {
      var lcpEntry = findLast(entries, function (entry) {
        return (
          entry.entryType === 'largest-contentful-paint' &&
          entry.startTime < firstInteractionTimestamp &&
          entry.startTime < firstHidden.timeStamp &&
          entry.startTime < TIMING_MAXIMUM_DELAY
        )
      })
      if (lcpEntry) {
        callback(lcpEntry.startTime)
      }
    }
  )
  var unsubscribeLifeCycle = subscribe.unsubscribe

  return {
    stop: function () {
      stopEventListener()
      unsubscribeLifeCycle()
    }
  }
}

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
          firstInputTime: firstInputEntry.startTime
        })
      }
    }
  )
  return {
    stop: subscribe.unsubscribe
  }
}
