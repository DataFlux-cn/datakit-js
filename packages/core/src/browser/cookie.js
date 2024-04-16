import {
  findCommaSeparatedValue,
  UUID,
  ONE_SECOND,
  findCommaSeparatedValues
} from '../helper/tools'
export var COOKIE_ACCESS_DELAY = ONE_SECOND

export function setCookie(name, value, expireDelay, options) {
  var date = new Date()
  date.setTime(date.getTime() + expireDelay)
  var expires = 'expires=' + date.toUTCString()
  var sameSite = options && options.crossSite ? 'none' : 'strict'
  var domain = options && options.domain ? ';domain=' + options.domain : ''
  var secure = options && options.secure ? ';secure' : ''
  var partitioned = options && options.partitioned ? ';partitioned' : ''
  document.cookie =
    name +
    '=' +
    value +
    ';' +
    expires +
    ';path=/;samesite=' +
    sameSite +
    domain +
    secure +
    partitioned
}

export function getCookie(name) {
  return findCommaSeparatedValue(document.cookie, name)
}
var initCookieParsed
/**
 * Returns a cached value of the cookie. Use this during SDK initialization (and whenever possible)
 * to avoid accessing document.cookie multiple times.
 */
export function getInitCookie(name) {
  if (!initCookieParsed) {
    initCookieParsed = findCommaSeparatedValues(document.cookie)
  }
  return initCookieParsed.get(name)
}

export function resetInitCookies() {
  initCookieParsed = undefined
}
export function deleteCookie(name, options) {
  setCookie(name, '', 0, options)
}

export function areCookiesAuthorized(options) {
  if (document.cookie === undefined || document.cookie === null) {
    return false
  }
  try {
    // Use a unique cookie name to avoid issues when the SDK is initialized multiple times during
    // the test cookie lifetime
    var testCookieName = `gc_cookie_test_${UUID()}`
    var testCookieValue = 'test'
    setCookie(testCookieName, testCookieValue, ONE_SECOND, options)
    return getCookie(testCookieName) === testCookieValue
  } catch (error) {
    return false
  }
}

/**
 * No API to retrieve it, number of levels for subdomain and suffix are unknown
 * strategy: find the minimal domain on which cookies are allowed to be set
 * https://web.dev/same-site-same-origin/#site
 */
var getCurrentSiteCache
export function getCurrentSite() {
  if (getCurrentSiteCache === undefined) {
    // Use a unique cookie name to avoid issues when the SDK is initialized multiple times during
    // the test cookie lifetime
    var testCookieName = `gc_site_test_${UUID()}`
    var testCookieValue = 'test'

    var domainLevels = window.location.hostname.split('.')
    var candidateDomain = domainLevels.pop()
    while (domainLevels.length && !getCookie(testCookieName)) {
      candidateDomain = domainLevels.pop() + '.' + candidateDomain
      setCookie(testCookieName, testCookieValue, ONE_SECOND, {
        domain: candidateDomain
      })
    }
    getCurrentSiteCache = candidateDomain
  }
  return getCurrentSiteCache
}
