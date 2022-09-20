import {
  isEmptyObject,
  msToNs,
  extend2Lev,
  toServerDuration,
  mapValues,
  RumEventType,
  LifeCycleEventType
} from '@cloudcare/browser-core'
import { trackViews } from './trackViews'
import { toValidEntry } from '../resource/resourceUtils'
export function startViewCollection(lifeCycle, configuration, location) {
  lifeCycle.subscribe(LifeCycleEventType.VIEW_UPDATED, function (view) {
    lifeCycle.notify(
      LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
      processViewUpdate(view)
    )
  })

  return trackViews(location, lifeCycle)
}
function computePerformanceViewDetails(entry) {
  var validEntry = toValidEntry(entry)
  if (!validEntry) {
    return undefined
  }
  var fetchStart = validEntry.fetchStart,
    responseEnd = validEntry.responseEnd,
    domInteractive = validEntry.domInteractive,
    domContentLoaded = validEntry.domContentLoaded,
    domComplete = validEntry.domComplete,
    loadEventEnd = validEntry.loadEventEnd,
    loadEventStart = validEntry.loadEventStart,
    domContentLoadedEventEnd = validEntry.domContentLoadedEventEnd
  var details = {
    fmp: msToNs(validEntry.largestContentfulPaint)
  }
  if (responseEnd !== fetchStart) {
    details.fpt = msToNs(responseEnd - fetchStart)
    var apdexLevel = parseInt((responseEnd - fetchStart) / 1000) // 秒数取整
    details.apdexLevel = apdexLevel > 9 ? 9 : apdexLevel
  }
  if (domInteractive !== fetchStart) {
    details.tti = msToNs(domInteractive - fetchStart)
  }
  if (domContentLoaded !== fetchStart) {
    details.domReady = msToNs(domContentLoaded - fetchStart)
  }
  // Make sure a connection occurred
  if (loadEventEnd !== fetchStart) {
    details.load = msToNs(loadEventEnd - fetchStart)
  }
  if (loadEventStart !== domContentLoadedEventEnd) {
    details.resourceLoadTime = msToNs(loadEventStart - domContentLoadedEventEnd)
  }
  if (domComplete !== domInteractive) {
    details.dom = msToNs(domComplete - domInteractive)
  }
  return details
}
function processViewUpdate(view) {
  var viewEvent = {
    _dd: {
      documentVersion: view.documentVersion
    },
    date: view.startClocks.timeStamp,
    type: RumEventType.VIEW,
    view: {
      action: {
        count: view.eventCounts.userActionCount
      },
      cumulativeLayoutShift: view.cumulativeLayoutShift,
      domComplete: msToNs(view.timings.domComplete),
      domContentLoaded: msToNs(view.timings.domContentLoaded),
      domInteractive: msToNs(view.timings.domInteractive),
      error: {
        count: view.eventCounts.errorCount
      },
      firstContentfulPaint: msToNs(view.timings.firstContentfulPaint),
      firstInputDelay: msToNs(view.timings.firstInputDelay),
      firstInputTime: msToNs(view.timings.firstInputTime),
      largestContentfulPaint: msToNs(view.timings.largestContentfulPaint),
      loadEventEnd: msToNs(view.timings.loadEventEnd),
      load_event: msToNs(view.timings.load_event),
      loadingTime: msToNs(view.loadingTime),
      loadingType: view.loadingType,
      isActive: view.isActive,
      name: view.name,
      longTask: {
        count: view.eventCounts.longTaskCount
      },
      resource: {
        count: view.eventCounts.resourceCount
      },
      timeSpent: msToNs(view.duration)
    },
    session: {
      hasReplay: view.hasReplay || undefined
    }
  }
  if (!isEmptyObject(view.customTimings)) {
    viewEvent.view.custom_timings = mapValues(
      view.customTimings,
      toServerDuration
    )
  }
  viewEvent = extend2Lev(viewEvent, {
    view: computePerformanceViewDetails(view.timings)
  })
  return {
    rawRumEvent: viewEvent,
    startTime: view.startClocks.relative
  }
}
