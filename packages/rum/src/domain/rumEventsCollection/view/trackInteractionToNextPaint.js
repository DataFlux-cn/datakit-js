import {
  noop,
  LifeCycleEventType,
  ViewLoadingType
} from '@cloudcare/browser-core'
import { supportPerformanceTimingEvent } from '../../performanceCollection'

import {
  getInteractionCount,
  initInteractionCountPolyfill
} from './interactionCountPolyfill'

// Arbitrary value to prevent unnecessary memory usage on views with lots of interactions.
var MAX_INTERACTION_ENTRIES = 10

/**
 * Track the interaction to next paint (INP).
 * To avoid outliers, return the p98 worst interaction of the view.
 * Documentation: https://web.dev/inp/
 * Reference implementation: https://github.com/GoogleChrome/web-vitals/blob/main/src/onINP.ts
 */
export function trackInteractionToNextPaint(viewLoadingType, lifeCycle) {
  if (!isInteractionToNextPaintSupported()) {
    return {
      getInteractionToNextPaint: function () {
        return undefined
      },
      stop: noop
    }
  }

  var _trackViewInteractionCount = trackViewInteractionCount(viewLoadingType)
  var getViewInteractionCount =
    _trackViewInteractionCount.getViewInteractionCount
  var longestInteractions = trackLongestInteractions(getViewInteractionCount)
  var inpDuration = -1

  var subscribe = lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
    function (entries) {
      for (var entry of entries) {
        if (
          (entry.entryType === 'event' || entry.entryType === 'first-input') &&
          entry.interactionId
        ) {
          longestInteractions.process(entry)
        }
      }

      var newInpDuration = longestInteractions.estimateP98Duration()
      if (newInpDuration) {
        inpDuration = newInpDuration
      }
    }
  )

  return {
    getInteractionToNextPaint: function () {
      // If no INP duration where captured because of the performanceObserver 40ms threshold
      // but the view interaction count > 0 then report 0
      if (inpDuration >= 0) {
        return inpDuration
      } else if (getViewInteractionCount()) {
        return 0
      }
    },
    stop: subscribe.unsubscribe
  }
}

function trackLongestInteractions(getViewInteractionCount) {
  var longestInteractions = []

  function sortAndTrimLongestInteractions() {
    longestInteractions
      .sort(function (a, b) {
        return b.duration - a.duration
      })
      .splice(MAX_INTERACTION_ENTRIES)
  }

  return {
    /**
     * Process the performance entry:
     * - if its duration is long enough, add the performance entry to the list of worst interactions
     * - if an entry with the same interaction id exists and its duration is lower than the new one, then replace it in the list of worst interactions
     */
    process: function (entry) {
      var interactionIndex = longestInteractions.findIndex(function (
        interaction
      ) {
        return entry.interactionId === interaction.interactionId
      })

      var minLongestInteraction =
        longestInteractions[longestInteractions.length - 1]

      if (interactionIndex !== -1) {
        if (entry.duration > longestInteractions[interactionIndex].duration) {
          longestInteractions[interactionIndex] = entry
          sortAndTrimLongestInteractions()
        }
      } else if (
        longestInteractions.length < MAX_INTERACTION_ENTRIES ||
        entry.duration > minLongestInteraction.duration
      ) {
        longestInteractions.push(entry)
        sortAndTrimLongestInteractions()
      }
    },
    /**
     * Compute the p98 longest interaction.
     * For better performance the computation is based on 10 longest interactions and the interaction count of the current view.
     */
    estimateP98Duration: function () {
      var interactionIndex = Math.min(
        longestInteractions.length - 1,
        Math.floor(getViewInteractionCount() / 50)
      )
      return longestInteractions[interactionIndex]
        ? longestInteractions[interactionIndex].duration
        : undefined
    }
  }
}

export function trackViewInteractionCount(viewLoadingType) {
  initInteractionCountPolyfill()
  var previousInteractionCount =
    viewLoadingType === ViewLoadingType.INITIAL_LOAD ? 0 : getInteractionCount()
  return {
    getViewInteractionCount: function () {
      return getInteractionCount() - previousInteractionCount
    }
  }
}

export function isInteractionToNextPaintSupported() {
  return (
    supportPerformanceTimingEvent('event') &&
    window.PerformanceEventTiming &&
    'interactionId' in PerformanceEventTiming.prototype
  )
}
