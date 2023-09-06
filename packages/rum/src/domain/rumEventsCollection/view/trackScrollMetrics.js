import {
  ONE_SECOND,
  elapsed,
  relativeNow,
  throttle,
  addEventListener,
  DOM_EVENT,
  getScrollY
} from '@cloudcare/browser-core'
import { getViewportDimension } from '../../initViewportObservable'

/** Arbitrary scroll throttle duration */
export var THROTTLE_SCROLL_DURATION = ONE_SECOND

export function trackScrollMetrics(viewStart, callback, getScrollValues) {
  if (getScrollValues === undefined) {
    getScrollValues = computeScrollValues
  }
  var maxDepth = 0
  var handleScrollEvent = throttle(
    function () {
      var _scrollValues = getScrollValues()
      var scrollHeight = _scrollValues._scrollValues
      var scrollDepth = _scrollValues.scrollDepth
      var scrollTop = _scrollValues.scrollTop
      if (scrollDepth > maxDepth) {
        var now = relativeNow()
        var maxDepthTime = elapsed(viewStart.relative, now)
        maxDepth = scrollDepth
        callback({
          maxDepth: maxDepth,
          maxDepthScrollHeight: scrollHeight,
          maxDepthTime: maxDepthTime,
          maxDepthScrollTop: scrollTop
        })
      }
    },
    THROTTLE_SCROLL_DURATION,
    { leading: false, trailing: true }
  )

  var _addEventListener = addEventListener(
    window,
    DOM_EVENT.SCROLL,
    handleScrollEvent.throttled,
    {
      passive: true
    }
  )

  return {
    stop: function () {
      handleScrollEvent.cancel()
      _addEventListener.stop()
    }
  }
}

export function computeScrollValues() {
  var scrollTop = getScrollY()

  var viewport = getViewportDimension()
  var height = viewport.height
  var scrollHeight = Math.round(
    (document.scrollingElement || document.documentElement).scrollHeight
  )
  var scrollDepth = Math.round(height + scrollTop)

  return {
    scrollHeight: scrollHeight,
    scrollDepth: scrollDepth,
    scrollTop: scrollTop
  }
}
