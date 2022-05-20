import {
  startSessionManagement,
  performDraw,
  LifeCycleEventType
} from '@cloudcare/browser-core'
export var RUM_SESSION_KEY = 'rum'
export var RumTrackingType = {
  NOT_TRACKED: '0',
  TRACKED_WITH_RESOURCES: '1',
  TRACKED_WITHOUT_RESOURCES: '2',
  TRACKED_WITH_SERVICE: '3' // 采样数据添加额外的tag，不舍弃，直接上报到服务端
}
export function startRumSession(configuration, lifeCycle) {
  var session = startSessionManagement(
    configuration.cookieOptions,
    RUM_SESSION_KEY,
    function (rawTrackingType) {
      return computeSessionState(configuration, rawTrackingType)
    }
  )

  session.renewObservable.subscribe(function () {
    lifeCycle.notify(LifeCycleEventType.SESSION_RENEWED)
  })

  return {
    getId: session.getId,
    getAnonymousID: session.getAnonymousID,
    getDebugSession: session.getDebugSession,
    addDebugSession: session.addDebugSession,
    clearDebugSession: session.clearDebugSession,
    isTracked: function () {
      return (
        session.getId() !== undefined && isTracked(session.getTrackingType())
      )
    },
    isTrackedWidthService: function() {
      return session.getId() !== undefined && session.getTrackingType() === RumTrackingType.TRACKED_WITH_SERVICE
    },
    isTrackedWithResource: function () {
      var trackingType = session.getTrackingType()
      return (
        session.getId() !== undefined &&
        (trackingType === RumTrackingType.TRACKED_WITH_RESOURCES || trackingType === RumTrackingType.TRACKED_WITH_SERVICE)
      )
    },
  }
}

function computeSessionState(configuration, rawTrackingType) {
  var trackingType
  if (hasValidRumSession(rawTrackingType)) {
    trackingType = rawTrackingType
  } else if (!performDraw(configuration.sampleRate)) {
    if (configuration.isServiceSampling) {
      trackingType = RumTrackingType.TRACKED_WITH_SERVICE
    } else {
      trackingType = RumTrackingType.NOT_TRACKED
    }
    
  } else if (!performDraw(configuration.resourceSampleRate)) {
    // trackingType = RumTrackingType.TRACKED_WITHOUT_RESOURCES
    if (configuration.isServiceSampling) {
      trackingType = RumTrackingType.TRACKED_WITH_SERVICE
    } else {
      trackingType = RumTrackingType.TRACKED_WITHOUT_RESOURCES
    }
  } else {
    trackingType = RumTrackingType.TRACKED_WITH_RESOURCES
  }
  return {
    trackingType: trackingType,
    isTracked: isTracked(trackingType)
  }
}

function hasValidRumSession(trackingType) {
  return (
    trackingType === RumTrackingType.NOT_TRACKED ||
    trackingType === RumTrackingType.TRACKED_WITH_RESOURCES ||
    trackingType === RumTrackingType.TRACKED_WITHOUT_RESOURCES || 
    trackingType === RumTrackingType.TRACKED_WITH_SERVICE
  )
}

function isTracked(rumSessionType) {
  return (
    rumSessionType === RumTrackingType.TRACKED_WITH_RESOURCES ||
    rumSessionType === RumTrackingType.TRACKED_WITHOUT_RESOURCES || 
    rumSessionType === RumTrackingType.TRACKED_WITH_SERVICE
  )
}
