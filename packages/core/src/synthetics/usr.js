import { getCookie, setCookie } from '../browser/cookie'
import { ONE_HOUR, UUID } from '../helper/tools'

export var ANONYMOUS_ID_COOKIE_NAME = '_dataflulx_usr_id'
export var ANONYMOUS_ID_EXPIRATION = 60 * 24 * ONE_HOUR

export var startCacheUsrCache = function(configuration) {
  var usrCacheId = getCookie(ANONYMOUS_ID_COOKIE_NAME)
  if (!usrCacheId) {
    usrCacheId = UUID()
    setCookie(ANONYMOUS_ID_COOKIE_NAME, usrCacheId, ANONYMOUS_ID_EXPIRATION, configuration.cookieOptions)
  }
  return {
    getUsrId: function() {
      return usrCacheId
    }
  }
}