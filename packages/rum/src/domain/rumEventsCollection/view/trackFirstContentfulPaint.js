import { find, LifeCycleEventType, ONE_MINUTE } from '@cloudcare/browser-core'
import { trackFirstHidden } from './trackFirstHidden'
export var TIMING_MAXIMUM_DELAY = 10 * ONE_MINUTE
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
