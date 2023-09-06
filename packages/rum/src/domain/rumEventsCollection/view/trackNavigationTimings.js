import { LifeCycleEventType, relativeNow } from '@cloudcare/browser-core'
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
