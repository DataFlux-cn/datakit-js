import {
  isEmptyObject,
  mapValues,
  toServerDuration,
  isNumber,
  RumEventType,
  LifeCycleEventType,
  extend2Lev,
  findByPath
} from '@cloudcare/browser-core'
import { trackViews } from './trackViews'
import { toValidEntry } from '../resource/resourceUtils'
export function startViewCollection(
  lifeCycle,
  configuration,
  location,
  domMutationObservable,
  locationChangeObservable,
  pageStateHistory,
  recorderApi,
  initialViewOptions
) {
  lifeCycle.subscribe(LifeCycleEventType.VIEW_UPDATED, function (view) {
    lifeCycle.notify(
      LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
      processViewUpdate(view, configuration, recorderApi, pageStateHistory)
    )
  })

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
  var details = {}
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
    details.resource_load_time = toServerDuration(
      loadEventStart - domContentLoadedEventEnd
    )
  }
  if (domComplete !== domInteractive) {
    details.dom = toServerDuration(domComplete - domInteractive)
  }
  return details
}

function processViewUpdate(view, configuration, recorderApi, pageStateHistory) {
  var replayStats = recorderApi.getReplayStats(view.id)
  var pageStates = pageStateHistory.findAll(
    view.startClocks.relative,
    view.duration
  )
  var viewEvent = {
    _gc: {
      document_version: view.documentVersion,
      replay_stats: replayStats,
      page_states: pageStates
    },
    date: view.startClocks.timeStamp,
    type: RumEventType.VIEW,
    view: {
      action: {
        count: view.eventCounts.actionCount
      },
      frustration: {
        count: view.eventCounts.frustrationCount
      },
      cumulative_layout_shift: findByPath(
        view.commonViewMetrics,
        'cumulativeLayoutShift.value'
      ),
      cumulative_layout_shift_target_selector: findByPath(
        view.commonViewMetrics,
        'cumulativeLayoutShift.targetSelector'
      ),
      first_byte: toServerDuration(
        findByPath(view.initialViewMetrics, 'navigationTimings.firstByte')
      ),
      dom_complete: toServerDuration(
        findByPath(view.initialViewMetrics, 'navigationTimings.domComplete')
      ),
      dom_content_loaded: toServerDuration(
        findByPath(
          view.initialViewMetrics,
          'navigationTimings.domContentLoaded'
        )
      ),
      dom_interactive: toServerDuration(
        findByPath(view.initialViewMetrics, 'navigationTimings.domInteractive')
      ),
      error: {
        count: view.eventCounts.errorCount
      },
      first_contentful_paint: toServerDuration(
        findByPath(view.initialViewMetrics, 'firstContentfulPaint')
      ),
      first_input_delay: toServerDuration(
        findByPath(view.initialViewMetrics, 'firstInput.delay')
      ),
      first_input_time: toServerDuration(
        findByPath(view.initialViewMetrics, 'firstInput.time')
      ),
      first_input_target_selector: findByPath(
        view.initialViewMetrics,
        'firstInput.targetSelector'
      ),
      interaction_to_next_paint: toServerDuration(
        findByPath(view.commonViewMetrics, 'interactionToNextPaint.value')
      ),
      interaction_to_next_paint_target_selector: findByPath(
        view.commonViewMetrics,
        'interactionToNextPaint.targetSelector'
      ),
      is_active: view.isActive,
      name: view.name,
      largest_contentful_paint: toServerDuration(
        findByPath(view.initialViewMetrics, 'largestContentfulPaint.value')
      ),
      largest_contentful_paint_element_selector: findByPath(
        view.initialViewMetrics,
        'largestContentfulPaint.targetSelector'
      ),
      load_event: toServerDuration(
        findByPath(view.initialViewMetrics, 'navigationTimings.loadEvent')
      ),
      loading_time: discardNegativeDuration(
        toServerDuration(view.commonViewMetrics.loadingTime)
      ),
      loading_type: view.loadingType,
      long_task: {
        count: view.eventCounts.longTaskCount
      },
      resource: {
        count: view.eventCounts.resourceCount
      },
      time_spent: toServerDuration(view.duration)
    },
    display: view.commonViewMetrics.scroll
      ? {
          scroll: {
            max_depth: view.commonViewMetrics.scroll.maxDepth,
            max_depth_scroll_top:
              view.commonViewMetrics.scroll.maxDepthScrollTop,
            max_scroll_height: view.commonViewMetrics.scroll.maxScrollHeight,
            max_scroll_height_time: toServerDuration(
              view.commonViewMetrics.scroll.maxScrollHeightTime
            )
          }
        }
      : undefined,
    session: {
      has_replay: replayStats ? true : undefined,
      is_active: view.sessionIsActive ? undefined : false
    },
    privacy: {
      replay_level: configuration.defaultPrivacyLevel
    }
  }
  if (!isEmptyObject(view.customTimings)) {
    viewEvent.view.custom_timings = mapValues(
      view.customTimings,
      toServerDuration
    )
  }
  viewEvent = extend2Lev(viewEvent, {
    view: computePerformanceViewDetails(view.initialViewMetrics)
  })
  return {
    rawRumEvent: viewEvent,
    startTime: view.startClocks.relative,
    domainContext: {
      location: view.location
    }
  }
}

function discardNegativeDuration(duration) {
  return isNumber(duration) && duration < 0 ? undefined : duration
}
