import { COOKIE_ACCESS_DELAY } from '../browser/cookie'
import { Observable } from '../helper/observable'
import { dateNow, UUID, throttle } from '../helper/tools'
import { SESSION_TIME_OUT_DELAY } from './sessionConstants'
import { retrieveSession, withCookieLockAccess } from './sessionCookieStore'

/**
 * Different session concepts:
 * - tracked, the session has an id and is updated along the user navigation
 * - not tracked, the session does not have an id but it is updated along the user navigation
 * - inactive, no session in store or session expired, waiting for a renew session
 */
export function startSessionStore(options, productKey, computeSessionState) {
  var renewObservable = new Observable()
  var expireObservable = new Observable()

  var watchSessionTimeoutId = setInterval(watchSession, COOKIE_ACCESS_DELAY)
  var sessionCache = retrieveActiveSession()

  function expandOrRenewSession() {
    var isTracked
    withCookieLockAccess({
      options: options,
      process: function (cookieSession) {
        var synchronizedSession = synchronizeSession(cookieSession)
        isTracked = expandOrRenewCookie(synchronizedSession)
        return synchronizedSession
      },
      after: function (cookieSession) {
        if (isTracked && !hasSessionInCache()) {
          renewSession(cookieSession)
        }
        sessionCache = cookieSession
      }
    })
  }

  function expandSession() {
    withCookieLockAccess({
      options: options,
      process: function (cookieSession) {
        return hasSessionInCache()
          ? synchronizeSession(cookieSession)
          : undefined
      }
    })
  }

  /**
   * allows two behaviors:
   * - if the session is active, synchronize the session cache without updating the session cookie
   * - if the session is not active, clear the session cookie and expire the session cache
   */
  function watchSession() {
    withCookieLockAccess({
      options: options,
      process: function (cookieSession) {
        return !isActiveSession(cookieSession) ? {} : undefined
      },
      after: synchronizeSession
    })
  }

  function synchronizeSession(cookieSession) {
    if (!isActiveSession(cookieSession)) {
      cookieSession = {}
    }
    if (hasSessionInCache()) {
      if (isSessionInCacheOutdated(cookieSession)) {
        expireSession()
      } else {
        sessionCache = cookieSession
      }
    }
    return cookieSession
  }

  function expandOrRenewCookie(cookieSession) {
    var sessionState = computeSessionState(cookieSession[productKey])
    var trackingType = sessionState.trackingType
    var isTracked = sessionState.isTracked
    cookieSession[productKey] = trackingType
    if (isTracked && !cookieSession.id) {
      cookieSession.id = UUID()
      cookieSession.created = String(dateNow())
    }
    return isTracked
  }

  function hasSessionInCache() {
    return sessionCache[productKey] !== undefined
  }

  function isSessionInCacheOutdated(cookieSession) {
    return (
      sessionCache.id !== cookieSession.id ||
      sessionCache[productKey] !== cookieSession[productKey]
    )
  }

  function expireSession() {
    sessionCache = {}
    expireObservable.notify()
  }

  function renewSession(cookieSession) {
    sessionCache = cookieSession
    renewObservable.notify()
  }

  function retrieveActiveSession() {
    var session = retrieveSession()
    if (isActiveSession(session)) {
      return session
    }
    return {}
  }

  function isActiveSession(session) {
    // created and expire can be undefined for versions which was not storing them
    // these checks could be removed when older versions will not be available/live anymore
    return (
      (session.created === undefined ||
        dateNow() - Number(session.created) < SESSION_TIME_OUT_DELAY) &&
      (session.expire === undefined || dateNow() < Number(session.expire))
    )
  }

  return {
    expandOrRenewSession: throttle(expandOrRenewSession, COOKIE_ACCESS_DELAY)
      .throttled,
    expandSession: expandSession,
    getSession: function () {
      return sessionCache
    },
    renewObservable: renewObservable,
    expireObservable: expireObservable,
    stop: function () {
      clearInterval(watchSessionTimeoutId)
    }
  }
}
