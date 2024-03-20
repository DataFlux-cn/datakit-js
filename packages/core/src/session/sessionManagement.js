import { relativeNow, clocksOrigin, ONE_MINUTE, each } from '../helper/tools'
import {
  addEventListeners,
  addEventListener
} from '../browser/addEventListener'
import { ContextHistory } from '../helper/contextHistory'
import { startSessionStore } from './sessionStore'
import { SESSION_TIME_OUT_DELAY } from './sessionConstants'
import { DOM_EVENT } from '../helper/enums'
import { clearInterval, setInterval } from '../helper/timer'
import { Observable } from '../helper/observable'
export var VISIBILITY_CHECK_DELAY = ONE_MINUTE
var SESSION_CONTEXT_TIMEOUT_DELAY = SESSION_TIME_OUT_DELAY
var stopCallbacks = []

export var startSessionManager = function (
  options,
  productKey,
  computeSessionState
) {
  var renewObservable = new Observable()
  var expireObservable = new Observable()
  var sessionStore = startSessionStore(options, productKey, computeSessionState)
  stopCallbacks.push(function () {
    return sessionStore.stop()
  })

  var sessionContextHistory = new ContextHistory(SESSION_CONTEXT_TIMEOUT_DELAY)
  stopCallbacks.push(function () {
    return sessionContextHistory.stop()
  })

  sessionStore.renewObservable.subscribe(function () {
    sessionContextHistory.add(buildSessionContext(), relativeNow())
    renewObservable.notify()
  })
  sessionStore.expireObservable.subscribe(function () {
    expireObservable.notify()
    sessionContextHistory.closeActive(relativeNow())
  })

  sessionStore.expandOrRenewSession()
  sessionContextHistory.add(buildSessionContext(), clocksOrigin().relative)

  trackActivity(function () {
    return sessionStore.expandOrRenewSession()
  })
  trackVisibility(function () {
    return sessionStore.expandSession()
  })

  function buildSessionContext() {
    return {
      id: sessionStore.getSession().id,
      trackingType: sessionStore.getSession()[productKey]
    }
  }

  return {
    findActiveSession: function (startTime) {
      return sessionContextHistory.find(startTime)
    },
    renewObservable: renewObservable,
    expireObservable: expireObservable,
    expire: sessionStore.expire
  }
}

export function stopSessionManager() {
  each(stopCallbacks, function (e) {
    return e()
  })
  stopCallbacks = []
}

function trackActivity(expandOrRenewSession) {
  var _addEventListeners = addEventListeners(
    window,
    [
      DOM_EVENT.CLICK,
      DOM_EVENT.TOUCH_START,
      DOM_EVENT.KEY_DOWN,
      DOM_EVENT.SCROLL
    ],
    expandOrRenewSession,
    { capture: true, passive: true }
  )
  stopCallbacks.push(_addEventListeners.stop)
}

function trackVisibility(expandSession) {
  var expandSessionWhenVisible = function () {
    if (document.visibilityState === 'visible') {
      expandSession()
    }
  }
  var _addEventListener = addEventListener(
    document,
    DOM_EVENT.VISIBILITY_CHANGE,
    expandSessionWhenVisible
  )
  stopCallbacks.push(_addEventListener.stop)

  var visibilityCheckInterval = setInterval(
    expandSessionWhenVisible,
    VISIBILITY_CHECK_DELAY
  )
  stopCallbacks.push(function () {
    clearInterval(visibilityCheckInterval)
  })
}
