import { noop } from '@cloudcare/browser-core'

import { computeScrollValues, trackScrollMetrics } from './trackScrollMetrics'
import { trackLoadingTime } from './trackLoadingTime'
import {
  isLayoutShiftSupported,
  trackCumulativeLayoutShift
} from './trackCumulativeLayoutShift'
import { trackInteractionToNextPaint } from './trackInteractionToNextPaint'

export function trackCommonViewMetrics(
  lifeCycle,
  domMutationObservable,
  configuration,
  scheduleViewUpdate,
  loadingType,
  viewStart
) {
  var commonViewMetrics = {}
  var _trackLoadingTime = trackLoadingTime(
    lifeCycle,
    domMutationObservable,
    configuration,
    loadingType,
    viewStart,
    function (newLoadingTime) {
      commonViewMetrics.loadingTime = newLoadingTime

      // We compute scroll metrics at loading time to ensure we have scroll data when loading the view initially
      // This is to ensure that we have the depth data even if the user didn't scroll or if the view is not scrollable.
      var _computeScrollValues = computeScrollValues()

      commonViewMetrics.scroll = {
        maxDepth: _computeScrollValues.scrollDepth,
        maxDepthScrollHeight: _computeScrollValues.scrollHeight,
        maxDepthTime: newLoadingTime,
        maxDepthScrollTop: _computeScrollValues.scrollTop
      }
      scheduleViewUpdate()
    }
  )
  var stopLoadingTimeTracking = _trackLoadingTime.stop
  var setLoadEvent = _trackLoadingTime.setLoadEvent
  var _trackScrollMetrics = trackScrollMetrics(
    viewStart,
    function (newScrollMetrics) {
      commonViewMetrics.scroll = newScrollMetrics
    },
    computeScrollValues
  )
  var stopScrollMetricsTracking = _trackScrollMetrics.stop
  var stopCLSTracking
  if (isLayoutShiftSupported()) {
    commonViewMetrics.cumulativeLayoutShift = 0
    var _trackCumulativeLayoutShift = trackCumulativeLayoutShift(
      lifeCycle,
      function (cumulativeLayoutShift) {
        commonViewMetrics.cumulativeLayoutShift = cumulativeLayoutShift
        scheduleViewUpdate()
      }
    )
    stopCLSTracking = _trackCumulativeLayoutShift.stop
  } else {
    stopCLSTracking = noop
  }

  var _trackInteractionToNextPaint = trackInteractionToNextPaint(
    loadingType,
    lifeCycle
  )
  var stopINPTracking = _trackInteractionToNextPaint.stop
  var getInteractionToNextPaint =
    _trackInteractionToNextPaint.getInteractionToNextPaint
  return {
    stop: function () {
      stopLoadingTimeTracking()
      stopCLSTracking()
      stopScrollMetricsTracking()
      stopINPTracking()
    },
    setLoadEvent: setLoadEvent,
    getCommonViewMetrics: function () {
      commonViewMetrics.interactionToNextPaint = getInteractionToNextPaint()
      return commonViewMetrics
    }
  }
}
