import {
  performDraw,
  startSessionManager,
  LifeCycleEventType,
  noop,
  Observable
} from '@cloudcare/browser-core'

export var RUM_SESSION_KEY = 'rum'

export var RumSessionPlan = {
  WITHOUT_SESSION_REPLAY: 1,
  WITH_SESSION_REPLAY: 2
}

export var RumTrackingType = {
  NOT_TRACKED: '0',
  // Note: the "tracking type" value (stored in the session cookie) does not match the "session
  // plan" value (sent in RUM events). This is expected, and was done to keep retrocompatibility
  // with active sessions when upgrading the SDK.
  TRACKED_WITH_SESSION_REPLAY: '1',
  TRACKED_WITHOUT_SESSION_REPLAY: '2'
}

export function startRumSessionManager(configuration, lifeCycle) {
  var sessionManager = startSessionManager(
    configuration.cookieOptions,
    RUM_SESSION_KEY,
    function (rawTrackingType) {
      return computeSessionState(configuration, rawTrackingType)
    }
  )

  sessionManager.expireObservable.subscribe(function () {
    lifeCycle.notify(LifeCycleEventType.SESSION_EXPIRED)
  })

  sessionManager.renewObservable.subscribe(function () {
    lifeCycle.notify(LifeCycleEventType.SESSION_RENEWED)
  })

  return {
    findTrackedSession: function (startTime) {
      var session = sessionManager.findActiveSession(startTime)
      if (!session || !isTypeTracked(session.trackingType)) {
        return
      }
      var plan =
        session.trackingType === RumTrackingType.TRACKED_WITH_SESSION_REPLAY
          ? RumSessionPlan.WITH_SESSION_REPLAY
          : RumSessionPlan.WITHOUT_SESSION_REPLAY
      return {
        id: session.id,
        plan: plan,
        sessionReplayAllowed: plan === RumSessionPlan.WITH_SESSION_REPLAY
      }
    },
    expire: sessionManager.expire,
    expireObservable: sessionManager.expireObservable
  }
}

/**
 * Start a tracked replay session stub
 * It needs to be a premium plan in order to get long tasks
 */
export function startRumSessionManagerStub() {
  var session = {
    id: '00000000-aaaa-0000-aaaa-000000000000',
    plan: RumSessionPlan.WITHOUT_SESSION_REPLAY, // plan value should not be taken into account for mobile
    sessionReplayAllowed: false
  }
  return {
    findTrackedSession: function () {
      return session
    },
    expire: noop,
    expireObservable: new Observable()
  }
}

function computeSessionState(configuration, rawTrackingType) {
  var trackingType
  if (hasValidRumSession(rawTrackingType)) {
    trackingType = rawTrackingType
  } else if (!performDraw(configuration.sessionSampleRate)) {
    trackingType = RumTrackingType.NOT_TRACKED
  } else if (!performDraw(configuration.sessionReplaySampleRate)) {
    trackingType = RumTrackingType.TRACKED_WITHOUT_SESSION_REPLAY
  } else {
    trackingType = RumTrackingType.TRACKED_WITH_SESSION_REPLAY
  }
  return {
    trackingType: trackingType,
    isTracked: isTypeTracked(trackingType)
  }
}

function hasValidRumSession(trackingType) {
  return (
    trackingType === RumTrackingType.NOT_TRACKED ||
    trackingType === RumTrackingType.TRACKED_WITH_SESSION_REPLAY ||
    trackingType === RumTrackingType.TRACKED_WITHOUT_SESSION_REPLAY
  )
}

function isTypeTracked(rumSessionType) {
  return (
    rumSessionType === RumTrackingType.TRACKED_WITHOUT_SESSION_REPLAY ||
    rumSessionType === RumTrackingType.TRACKED_WITH_SESSION_REPLAY
  )
}
