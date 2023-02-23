import {
  shallowClone,
  assign,
  elapsed,
  UUID,
  ONE_MINUTE,
  throttle,
  clocksNow,
  clocksOrigin,
  timeStampNow,
  looksLikeRelativeTime,
  ViewLoadingType,
  LifeCycleEventType,
  PageExitReason,
  isHashAnAnchor,
  getPathFromHash
} from '@cloudcare/browser-core'

import { trackInitialViewTimings } from './trackInitialViewTimings'
import { trackViewMetrics } from './trackViewMetrics'
import { trackViewEventCounts } from './trackViewEventCounts'
export var THROTTLE_VIEW_UPDATE_PERIOD = 3000
export var SESSION_KEEP_ALIVE_INTERVAL = 5 * ONE_MINUTE

export function trackViews(
  location,
  lifeCycle,
  domMutationObservable,
  configuration,
  locationChangeObservable,
  areViewsTrackedAutomatically,
  initialViewOptions
) {
  var _trackInitialView = trackInitialView(initialViewOptions)
  var stopInitialViewTracking = _trackInitialView.stop
  var initialView = _trackInitialView.initialView
  var currentView = initialView

  var _startViewLifeCycle = startViewLifeCycle()
  var stopViewLifeCycle = _startViewLifeCycle.stop
  var locationChangeSubscription
  if (areViewsTrackedAutomatically) {
    locationChangeSubscription = renewViewOnLocationChange(
      locationChangeObservable
    )
  }

  function trackInitialView(options) {
    var initialView = newView(
      lifeCycle,
      domMutationObservable,
      configuration,
      location,
      ViewLoadingType.INITIAL_LOAD,
      clocksOrigin(),
      options
    )
    var _trackInitialViewTimings = trackInitialViewTimings(
      lifeCycle,
      function (timings) {
        initialView.updateTimings(timings)
        initialView.scheduleUpdate()
      }
    )
    return { initialView: initialView, stop: _trackInitialViewTimings.stop }
  }

  function trackViewChange(startClocks, viewOptions) {
    return newView(
      lifeCycle,
      domMutationObservable,
      configuration,
      location,
      ViewLoadingType.ROUTE_CHANGE,
      startClocks,
      viewOptions
    )
  }

  function startViewLifeCycle() {
    lifeCycle.subscribe(LifeCycleEventType.SESSION_RENEWED, function () {
      // do not trigger view update to avoid wrong data
      currentView.end()
      // Renew view on session renewal
      currentView = trackViewChange(undefined, {
        name: currentView.name,
        service: currentView.service,
        version: currentView.version
      })
    })

    // End the current view on page unload
    lifeCycle.subscribe(
      LifeCycleEventType.PAGE_EXITED,
      function (pageExitEvent) {
        if (pageExitEvent.reason === PageExitReason.UNLOADING) {
          currentView.end()
          currentView.triggerUpdate()
        }
      }
    )
    // Session keep alive
    var keepAliveInterval = window.setInterval(function () {
      currentView.triggerUpdate()
    }, SESSION_KEEP_ALIVE_INTERVAL)

    return {
      stop: function () {
        clearInterval(keepAliveInterval)
      }
    }
  }

  function renewViewOnLocationChange(locationChangeObservable) {
    return locationChangeObservable.subscribe(function (params) {
      var oldLocation = params.oldLocation
      var newLocation = params.newLocation
      if (areDifferentLocation(oldLocation, newLocation)) {
        currentView.end()
        currentView.triggerUpdate()
        currentView = trackViewChange()
        return
      }
    })
  }

  return {
    addTiming: function (name, time) {
      if (typeof time === 'undefined') {
        time = timeStampNow()
      }
      currentView.addTiming(name, time)
      currentView.scheduleUpdate()
    },
    startView: function (options, startClocks) {
      currentView.end(startClocks)
      currentView.triggerUpdate()
      currentView = trackViewChange(startClocks, options)
    },
    stop: function () {
      if (locationChangeSubscription) {
        locationChangeSubscription.unsubscribe()
      }
      stopInitialViewTracking()
      stopViewLifeCycle()
      currentView.end()
    }
  }
}

function newView(
  lifeCycle,
  domMutationObservable,
  configuration,
  initialLocation,
  loadingType,
  startClocks,
  viewOptions
) {
  // Setup initial values
  if (typeof startClocks === 'undefined') {
    startClocks = clocksNow()
  }
  var id = UUID()
  var timings = {}
  var customTimings = {}
  var documentVersion = 0
  var endClocks
  var location = shallowClone(initialLocation)

  var name
  var service
  var version
  if (viewOptions) {
    name = viewOptions.name
    service = viewOptions.service
    version = viewOptions.version
  }

  lifeCycle.notify(LifeCycleEventType.VIEW_CREATED, {
    id: id,
    name: name,
    startClocks: startClocks,
    service: service,
    version: version
  })

  // Update the view every time the measures are changing
  var scheduleViewUpdate = throttle(
    triggerViewUpdate,
    THROTTLE_VIEW_UPDATE_PERIOD,
    {
      leading: false
    }
  )
  var cancelScheduleViewUpdate = scheduleViewUpdate.cancel

  var _trackViewMetrics = trackViewMetrics(
    lifeCycle,
    domMutationObservable,
    configuration,
    scheduleViewUpdate,
    loadingType,
    startClocks
  )
  var setLoadEvent = _trackViewMetrics.setLoadEvent
  var stopViewMetricsTracking = _trackViewMetrics.stop
  var viewMetrics = _trackViewMetrics.viewMetrics
  var _trackViewEventCounts = trackViewEventCounts(
    lifeCycle,
    id,
    scheduleViewUpdate
  )
  var scheduleStopEventCountsTracking = _trackViewEventCounts.scheduleStop
  var eventCounts = _trackViewEventCounts.eventCounts
  // Initial view update
  triggerViewUpdate()

  function triggerViewUpdate() {
    documentVersion += 1
    var currentEnd =
      endClocks === undefined ? timeStampNow() : endClocks.timeStamp
    lifeCycle.notify(
      LifeCycleEventType.VIEW_UPDATED,
      assign(
        {
          customTimings: customTimings,
          documentVersion: documentVersion,
          id: id,
          name: name,
          service: service,
          version: version,
          loadingType: loadingType,
          location: location,
          startClocks: startClocks,
          timings: timings,
          duration: elapsed(startClocks.timeStamp, currentEnd),
          isActive: endClocks === undefined,
          eventCounts: eventCounts
        },
        viewMetrics
      )
    )
  }

  return {
    name: name,
    service: service,
    version: version,
    scheduleUpdate: scheduleViewUpdate,
    end: function (clocks) {
      if (typeof clocks === 'undefined') {
        clocks = clocksNow()
      }
      endClocks = clocks
      lifeCycle.notify(LifeCycleEventType.VIEW_ENDED, { endClocks: endClocks })
      stopViewMetricsTracking()
      scheduleStopEventCountsTracking
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
      var relativeTime = looksLikeRelativeTime(time)
        ? time
        : elapsed(startClocks.timeStamp, time)
      customTimings[sanitizeTiming(name)] = relativeTime
    }
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

function areDifferentLocation(currentLocation, otherLocation) {
  return (
    currentLocation.pathname !== otherLocation.pathname ||
    (!isHashAnAnchor(otherLocation.hash) &&
      getPathFromHash(otherLocation.hash) !==
        getPathFromHash(currentLocation.hash))
  )
}
