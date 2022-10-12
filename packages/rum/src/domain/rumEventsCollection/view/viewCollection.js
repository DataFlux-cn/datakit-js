import { isEmptyObject, mapValues, toServerDuration, isNumber, RumEventType, LifeCycleEventType, extend2Lev } from '@cloudcare/browser-core'
import { trackViews } from './trackViews'
import { toValidEntry } from '../resource/resourceUtils'
export function startViewCollection(
  lifeCycle,
  configuration,
  location,
  domMutationObservable,
  locationChangeObservable,
  initialViewOptions
) {
  lifeCycle.subscribe(LifeCycleEventType.VIEW_UPDATED, function(view) {
      lifeCycle.notify(
        LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
        processViewUpdate(view)
      )
    }
  )

  return trackViews(
    location,
    lifeCycle,
    domMutationObservable,
    configuration,
    locationChangeObservable,
    !configuration.trackViewsManually,
    initialViewOptions
  )
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
    fmp: toServerDuration(validEntry.largestContentfulPaint)
  }
  if (responseEnd !== fetchStart) {
    details.fpt = toServerDuration(responseEnd - fetchStart)
    var apdexLevel = parseInt((responseEnd - fetchStart) / 1000) // 秒数取整
    details.apdexLevel = apdexLevel > 9 ? 9 : apdexLevel
  }
  if (domInteractive !== fetchStart) {
    details.tti = toServerDuration(domInteractive - fetchStart)
  }
  if (domContentLoaded !== fetchStart) {
    details.dom_ready = toServerDuration(domContentLoaded - fetchStart)
  }
  // Make sure a connection occurred
  if (loadEventEnd !== fetchStart) {
    details.load = toServerDuration(loadEventEnd - fetchStart)
  }
  if (loadEventStart !== domContentLoadedEventEnd) {
    details.resource_load_time = toServerDuration(loadEventStart - domContentLoadedEventEnd)
  }
  if (domComplete !== domInteractive) {
    details.dom = toServerDuration(domComplete - domInteractive)
  }
  return details
}
function processViewUpdate(
  view,
){
  var viewEvent = {
    _dd: {
      document_version: view.documentVersion,
    },
    date: view.startClocks.timeStamp,
    type: RumEventType.VIEW,
    view: {
      action: {
        count: view.eventCounts.actionCount,
      },
      frustration: {
        count: view.eventCounts.frustrationCount,
      },
      cumulative_layout_shift: view.cumulativeLayoutShift,
      first_byte: toServerDuration(view.timings.firstByte),
      dom_complete: toServerDuration(view.timings.domComplete),
      dom_content_loaded: toServerDuration(view.timings.domContentLoaded),
      dom_interactive: toServerDuration(view.timings.domInteractive),
      error: {
        count: view.eventCounts.errorCount,
      },
      first_contentful_paint: toServerDuration(view.timings.firstContentfulPaint),
      first_input_delay: toServerDuration(view.timings.firstInputDelay),
      first_input_time: toServerDuration(view.timings.firstInputTime),
      is_active: view.isActive,
      name: view.name,
      largest_contentful_paint: toServerDuration(view.timings.largestContentfulPaint),
      load_event: toServerDuration(view.timings.loadEvent),
      loading_time: discardNegativeDuration(toServerDuration(view.loadingTime)),
      loading_type: view.loadingType,
      long_task: {
        count: view.eventCounts.longTaskCount,
      },
      resource: {
        count: view.eventCounts.resourceCount,
      },
      time_spent: toServerDuration(view.duration),
    },
    // session: {
    //   has_replay: replayStats ? true : undefined,
    // },
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
    startTime: view.startClocks.relative,
    domainContext: {
      location: view.location,
    },
  }
}

function discardNegativeDuration(duration){
  return isNumber(duration) && duration < 0 ? undefined : duration
}
