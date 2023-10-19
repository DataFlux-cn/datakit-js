import {
  addEventListeners,
  getRelativeTime,
  isNumber,
  includes,
  each,
  extend,
  filter,
  dateNow,
  relativeNow,
  DOM_EVENT,
  LifeCycleEventType,
  runOnReadyState,
  setTimeout,
  addEventListener,
  monitor,
  assign
} from '@cloudcare/browser-core'
import {
  FAKE_INITIAL_DOCUMENT,
  isAllowedRequestUrl
} from './rumEventsCollection/resource/resourceUtils'
function supportPerformanceObject() {
  return window.performance !== undefined && 'getEntries' in performance
}

export function supportPerformanceTimingEvent(entryType) {
  return (
    window.PerformanceObserver &&
    PerformanceObserver.supportedEntryTypes !== undefined &&
    includes(PerformanceObserver.supportedEntryTypes, entryType)
  )
}
export function startPerformanceCollection(lifeCycle, configuration) {
  retrieveInitialDocumentResourceTiming(function (timing) {
    handleRumPerformanceEntries(lifeCycle, configuration, [timing])
  })

  if (supportPerformanceObject()) {
    var performanceEntries = performance.getEntries()
    // Because the performance entry list can be quite large
    // delay the computation to prevent the SDK from blocking the main thread on init
    setTimeout(function () {
      handleRumPerformanceEntries(lifeCycle, configuration, performanceEntries)
    })
  }
  if (window.PerformanceObserver) {
    var handlePerformanceEntryList = monitor(function (entries) {
      handleRumPerformanceEntries(
        lifeCycle,
        configuration,
        entries.getEntries()
      )
    })
    var mainEntries = ['resource', 'navigation', 'longtask', 'paint']
    var experimentalEntries = [
      'largest-contentful-paint',
      'first-input',
      'layout-shift',
      'event'
    ]
    try {
      // Experimental entries are not retrieved by performance.getEntries()
      // use a single PerformanceObserver with buffered flag by type
      // to get values that could happen before SDK init
      each(experimentalEntries, function (type) {
        var observer = new PerformanceObserver(handlePerformanceEntryList)
        observer.observe({
          type: type,
          buffered: true,
          // durationThreshold only impact PerformanceEventTiming entries used for INP computation which requires a threshold at 40 (default is 104ms)
          // cf: https://github.com/GoogleChrome/web-vitals/blob/3806160ffbc93c3c4abf210a167b81228172b31c/src/onINP.ts#L209
          durationThreshold: 40
        })
      })
    } catch (e) {
      // Some old browser versions (ex: chrome 67) don't support the PerformanceObserver type and buffered options
      // In these cases, fallback to PerformanceObserver with entryTypes
      each(experimentalEntries, function (type) {
        mainEntries.push(type)
      })
    }
    var mainObserver = new PerformanceObserver(handlePerformanceEntryList)
    mainObserver.observe({ entryTypes: mainEntries })
    if (supportPerformanceObject() && 'addEventListener' in performance) {
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1559377
      addEventListener(performance, 'resourcetimingbufferfull', function () {
        performance.clearResourceTimings()
      })
    }
  }
  if (!supportPerformanceTimingEvent('navigation')) {
    retrieveNavigationTiming(function (timing) {
      handleRumPerformanceEntries(lifeCycle, configuration, [timing])
    })
  }
  if (!supportPerformanceTimingEvent('first-input')) {
    retrieveFirstInputTiming(function (timing) {
      return handleRumPerformanceEntries(lifeCycle, configuration, [timing])
    })
  }
}

export function retrieveInitialDocumentResourceTiming(callback) {
  runOnReadyState('interactive', function () {
    var timing

    var forcedAttributes = {
      entryType: 'resource',
      initiatorType: FAKE_INITIAL_DOCUMENT,
      traceId: '',
      toJSON: function () {
        return assign({}, timing, { toJSON: undefined })
      }
    }
    if (
      supportPerformanceTimingEvent('navigation') &&
      performance.getEntriesByType('navigation').length > 0
    ) {
      var navigationEntry = performance.getEntriesByType('navigation')[0]
      timing = extend(navigationEntry.toJSON(), forcedAttributes)
    } else {
      var relativePerformanceTiming = computeRelativePerformanceTiming()
      timing = extend(
        relativePerformanceTiming,
        {
          decodedBodySize: 0,
          duration: relativePerformanceTiming.responseEnd,
          name: window.location.href,
          startTime: 0
        },
        forcedAttributes
      )
    }
    callback(timing)
  })
}

function retrieveNavigationTiming(callback) {
  function sendFakeTiming() {
    callback(
      extend(computeRelativePerformanceTiming(), { entryType: 'navigation' })
    )
  }

  runOnReadyState('complete', function () {
    // Send it a bit after the actual load event, so the "loadEventEnd" timing is accurate
    setTimeout(sendFakeTiming)
  })
}

/**
 * first-input timing entry polyfill based on
 * https://github.com/GoogleChrome/web-vitals/blob/master/src/lib/polyfills/firstInputPolyfill.ts
 */
function retrieveFirstInputTiming(callback) {
  var startTimeStamp = dateNow()
  var timingSent = false

  var listeners = addEventListeners(
    window,
    [
      DOM_EVENT.CLICK,
      DOM_EVENT.MOUSE_DOWN,
      DOM_EVENT.KEY_DOWN,
      DOM_EVENT.TOUCH_START,
      DOM_EVENT.POINTER_DOWN
    ],
    function (evt) {
      // Only count cancelable events, which should trigger behavior important to the user.
      if (!evt.cancelable) {
        return
      }

      // This timing will be used to compute the "first Input delay", which is the delta between
      // when the system received the event (e.g. evt.timeStamp) and when it could run the callback
      // (e.g. performance.now()).
      var timing = {
        entryType: 'first-input',
        processingStart: relativeNow(),
        processingEnd: relativeNow(),
        startTime: evt.timeStamp,
        duration: 0,
        name: ''
      }

      if (evt.type === DOM_EVENT.POINTER_DOWN) {
        sendTimingIfPointerIsNotCancelled(timing)
      } else {
        sendTiming(timing)
      }
    },
    { passive: true, capture: true }
  )
  var removeEventListeners = listeners.stop

  /**
   * Pointer events are a special case, because they can trigger main or compositor thread behavior.
   * We differenciate these cases based on whether or not we see a pointercancel event, which are
   * fired when we scroll. If we're scrolling we don't need to report input delay since FID excludes
   * scrolling and pinch/zooming.
   */
  function sendTimingIfPointerIsNotCancelled(timing) {
    addEventListeners(
      window,
      [DOM_EVENT.POINTER_UP, DOM_EVENT.POINTER_CANCEL],
      function (event) {
        if (event.type === DOM_EVENT.POINTER_UP) {
          sendTiming(timing)
        }
      },
      { once: true }
    )
  }

  function sendTiming(timing) {
    if (!timingSent) {
      timingSent = true
      removeEventListeners()
      // In some cases the recorded delay is clearly wrong, e.g. it's negative or it's larger than
      // the time between now and when the page was loaded.
      // - https://github.com/GoogleChromeLabs/first-input-delay/issues/4
      // - https://github.com/GoogleChromeLabs/first-input-delay/issues/6
      // - https://github.com/GoogleChromeLabs/first-input-delay/issues/7
      var delay = timing.processingStart - timing.startTime
      if (delay >= 0 && delay < dateNow() - startTimeStamp) {
        callback(timing)
      }
    }
  }
}

function computeRelativePerformanceTiming() {
  var result = {}
  var timing = performance.timing
  for (var key in timing) {
    if (isNumber(timing[key])) {
      result[key] = timing[key] === 0 ? 0 : getRelativeTime(timing[key])
    }
  }
  return result
}

function handleRumPerformanceEntries(lifeCycle, configuration, entries) {
  var rumPerformanceEntries = filter(entries, function (entry) {
    return (
      entry.entryType === 'resource' ||
      entry.entryType === 'navigation' ||
      entry.entryType === 'paint' ||
      entry.entryType === 'longtask' ||
      entry.entryType === 'largest-contentful-paint' ||
      entry.entryType === 'first-input' ||
      entry.entryType === 'layout-shift' ||
      entry.entryType === 'event'
    )
  })

  var rumAllowedPerformanceEntries = filter(
    rumPerformanceEntries,
    function (entry) {
      return (
        !isIncompleteNavigation(entry) &&
        !isForbiddenResource(configuration, entry)
      )
    }
  )

  if (rumAllowedPerformanceEntries.length) {
    lifeCycle.notify(
      LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
      rumAllowedPerformanceEntries
    )
  }
}

function isIncompleteNavigation(entry) {
  return entry.entryType === 'navigation' && entry.loadEventEnd <= 0
}

function isForbiddenResource(configuration, entry) {
  return (
    entry.entryType === 'resource' &&
    !isAllowedRequestUrl(configuration, entry.name)
  )
}
