import {
  addEventListeners,
  elapsed,
  extend,
  DOM_EVENT,
  find,
  findLast,
  LifeCycleEventType,
  ONE_MINUTE
} from '@cloudcare/browser-core'
import { trackFirstHidden } from './trackFirstHidden'
// Discard LCP and FCP timings above a certain delay to avoid incorrect data
// It happens in some cases like sleep mode or some browser implementations
export var TIMING_MAXIMUM_DELAY = 10 * ONE_MINUTE
export function trackInitialViewTimings(lifeCycle, callback) {
  var timings = {}
  function setTimings(newTimings) {
    timings = extend(timings, newTimings)
    callback(timings)
  }
  var _trackNavigationTimings = trackNavigationTimings(lifeCycle, setTimings)
  var stopNavigationTracking = _trackNavigationTimings.stop
  var _trackFirstContentfulPaint = trackFirstContentfulPaint(
    lifeCycle,
    function (firstContentfulPaint) {
      setTimings({ firstContentfulPaint: firstContentfulPaint })
    }
  )
  var stopFCPTracking = _trackFirstContentfulPaint.stop
  var _trackLargestContentfulPaint = trackLargestContentfulPaint(
    lifeCycle,
    window,
    function (largestContentfulPaint) {
      setTimings({ largestContentfulPaint: largestContentfulPaint })
    }
  )
  var stopLCPTracking = _trackLargestContentfulPaint.stop
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

  return {
    stop: function () {
      stopNavigationTracking()
      stopFCPTracking()
      stopLCPTracking()
      stopFIDTracking()
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
            domContentLoadedEventStart: entry.domContentLoadedEventStart
          })
        }
      }
    }
  )

  return { stop: subscribe.unsubscribe }
}

export function trackFirstContentfulPaint(lifeCycle, callback) {
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
export function trackLargestContentfulPaint(lifeCycle, emitter, callback) {
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
