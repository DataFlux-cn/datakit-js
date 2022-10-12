import { getCookie, setCookie, UUID, ONE_HOUR } from '@cloudcare/browser-core'
export var ANONYMOUS_ID_COOKIE_NAME = '_dataflulx_usr_id'
export var ANONYMOUS_ID_EXPIRATION = 60 * 24 * ONE_HOUR

export var startCacheUsrCache = function(configuration) {
  var usrCacheId = getCookie(ANONYMOUS_ID_COOKIE_NAME)
  if (!usrCacheId) {
    usrCacheId = UUID()
    setCookie(ANONYMOUS_ID_COOKIE_NAME, usrCacheId, ANONYMOUS_ID_EXPIRATION, configuration.cookieOptions)
  }
  return {
    getId: function() {
      return usrCacheId
    }
  }
}