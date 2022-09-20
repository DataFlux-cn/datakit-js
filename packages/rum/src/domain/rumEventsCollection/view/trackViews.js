import {
  elapsed,
  extend,
  UUID,
  ONE_MINUTE,
  throttle,
  clocksNow,
  clocksOrigin,
  timeStampNow,
  looksLikeRelativeTime,
  LifeCycleEventType
} from '@cloudcare/browser-core'
import { trackInitialViewTimings } from './trackInitialViewTimings'
import {
  trackLocationChanges,
  areDifferentLocation
} from './trackLocationChanges'
import { trackViewMetrics } from './trackViewMetrics'

export var THROTTLE_VIEW_UPDATE_PERIOD = 3000
export var SESSION_KEEP_ALIVE_INTERVAL = 5 * ONE_MINUTE
export var ViewLoadingType = {
  INITIAL_LOAD: 'initial_load',
  ROUTE_CHANGE: 'route_change'
}
export function trackViews(location, lifeCycle) {
  var isRecording = false
  // eslint-disable-next-line prefer-const
  var _trackInitialView = trackInitialView()
  var stopInitialViewTracking = _trackInitialView.stop
  var currentView = _trackInitialView.initialView
  var _trackLocationChanges = trackLocationChanges(function () {
    if (areDifferentLocation(currentView.getLocation(), location)) {
      // Renew view on location changes
      currentView.end()
      currentView.triggerUpdate()
      currentView = trackViewChange()
      return
    }
    currentView.updateLocation(location)
    currentView.triggerUpdate()
  })
  var stopLocationChangesTracking = _trackLocationChanges.stop
  // Renew view on session renewal
  lifeCycle.subscribe(LifeCycleEventType.SESSION_RENEWED, function () {
    // do not trigger view update to avoid wrong data
    currentView.end()
    currentView = trackViewChange()
  })

  // End the current view on page unload
  lifeCycle.subscribe(LifeCycleEventType.BEFORE_UNLOAD, function () {
    currentView.end()
    currentView.triggerUpdate()
  })

  lifeCycle.subscribe(LifeCycleEventType.RECORD_STARTED, function () {
    isRecording = true
    currentView.updateHasReplay(true)
  })

  lifeCycle.subscribe(LifeCycleEventType.RECORD_STOPPED, function () {
    isRecording = false
  })

  // Session keep alive
  var keepAliveInterval = window.setInterval(function () {
    currentView.triggerUpdate()
  }, SESSION_KEEP_ALIVE_INTERVAL)

  function trackInitialView() {
    var initialView = newView(
      lifeCycle,
      location,
      isRecording,
      ViewLoadingType.INITIAL_LOAD,
      document.referrer,
      clocksOrigin()
    )
    var _trackInitialViewTimings = trackInitialViewTimings(
      lifeCycle,
      function (timings) {
        initialView.updateTimings(timings)
        initialView.scheduleUpdate()
      }
    )
    var stop = _trackInitialViewTimings.stop
    return { initialView: initialView, stop: stop }
  }

  function trackViewChange() {
    return newView(
      lifeCycle,
      location,
      isRecording,
      ViewLoadingType.ROUTE_CHANGE,
      currentView.url
    )
  }

  return {
    addTiming: function (name, time) {
      if (typeof time === 'undefined') {
        time = timeStampNow()
      }
      currentView.addTiming(name, time)
      currentView.triggerUpdate()
    },
    stop: function () {
      stopInitialViewTracking()
      stopLocationChangesTracking()
      currentView.end()
      clearInterval(keepAliveInterval)
    }
  }
}

function newView(
  lifeCycle,
  initialLocation,
  initialHasReplay,
  loadingType,
  referrer,
  startClocks,
  name
) {
  if (typeof startClocks === 'undefined') {
    startClocks = clocksNow()
  }
  // Setup initial values
  var id = UUID()
  var timings = {}
  var customTimings = {}
  var documentVersion = 0
  var endClocks
  var location = extend({}, initialLocation)
  var hasReplay = initialHasReplay

  lifeCycle.notify(LifeCycleEventType.VIEW_CREATED, {
    id: id,
    startClocks: startClocks,
    location: location,
    referrer: referrer
  })
  var scheduleViewUpdate = throttle(
    triggerViewUpdate,
    THROTTLE_VIEW_UPDATE_PERIOD,
    {
      leading: false
    }
  )
  // Update the view every time the measures are changing
  var cancelScheduleViewUpdate = scheduleViewUpdate.cancel

  var _trackViewMetrics = trackViewMetrics(
    lifeCycle,
    scheduleViewUpdate,
    loadingType
  )

  var setLoadEvent = _trackViewMetrics.setLoadEvent
  var viewMetrics = _trackViewMetrics.viewMetrics
  var stopViewMetricsTracking = _trackViewMetrics.stop
  // Initial view update
  triggerViewUpdate()
  function triggerViewUpdate() {
    documentVersion += 1
    var currentEnd = endClocks === undefined ? timeStampNow() : endClocks.timeStamp
    lifeCycle.notify(
      LifeCycleEventType.VIEW_UPDATED,
      extend({}, viewMetrics, {
        customTimings: customTimings,
        documentVersion: documentVersion,
        id: id,
        name: name,
        loadingType: loadingType,
        location: location,
        hasReplay: hasReplay,
        referrer: referrer,
        startClocks: startClocks,
        timings: timings,
        duration: elapsed(
          startClocks.timeStamp, currentEnd
        ),
        isActive: endClocks === undefined
      })
    )
  }

  return {
    scheduleUpdate: scheduleViewUpdate,
    end: function () {
      endClocks = clocksNow()
      stopViewMetricsTracking()
      lifeCycle.notify(LifeCycleEventType.VIEW_ENDED, { endClocks: endClocks })
    },
    getLocation: function () {
      return location
    },
    triggerUpdate: function () {
      // cancel any pending view updates execution
      cancelScheduleViewUpdate()
      triggerViewUpdate()
    },
    updateTimings: function (newTimings) {
      timings = newTimings
      if (newTimings.loadEvent !== undefined) {
        setLoadEvent(newTimings.loadEvent)
      }
    },
    addTiming: function (name, time) {
      const relativeTime = looksLikeRelativeTime(time) ? time : elapsed(startClocks.timeStamp, time)
      customTimings[sanitizeTiming(name)] = relativeTime
      
    },
    updateLocation: function (newLocation) {
      location = extend({}, newLocation)
    },
    updateHasReplay: function (newHasReplay) {
      hasReplay = newHasReplay
    },
    url: location.href
  }
}

/**
 * Timing name is used as facet path that must contain only letters, digits, or the characters - _ . @ $
 */
function sanitizeTiming(name) {
  var sanitized = name.replace(/[^a-zA-Z0-9-_.@$]/g, '_')
  if (sanitized !== name) {
    console.warn(
      'Invalid timing name: ' + name + ', sanitized to: ' + sanitized
    )
  }
  return sanitized
}
