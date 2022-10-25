import { getCurrentSite } from '../browser/cookie'
import { catchUserErrors } from '../helper/catchUserErrors'
import { display } from '../helper/display'
import { assign, isPercentage, ONE_KIBI_BYTE, ONE_SECOND, isNullUndefinedDefaultValue } from '../helper/tools'
import { computeTransportConfiguration } from './transportConfiguration'
export function validateAndBuildConfiguration(initConfiguration){
  if (initConfiguration.sampleRate !== undefined && !isPercentage(initConfiguration.sampleRate)) {
    display.error('Sample Rate should be a number between 0 and 100')
    return
  }
  return assign(
    {
      beforeSend:
        initConfiguration.beforeSend && catchUserErrors(initConfiguration.beforeSend, 'beforeSend threw an error:'),
      cookieOptions: buildCookieOptions(initConfiguration),
      sampleRate: isNullUndefinedDefaultValue(initConfiguration.sampleRate, 100),
      service: initConfiguration.service,
      version: initConfiguration.version,
      env: initConfiguration.env,
      silentMultipleInit: !!initConfiguration.silentMultipleInit,

      /**
       * beacon payload max queue size implementation is 64kb
       * ensure that we leave room for logs, rum and potential other users
       */
      batchBytesLimit: 16 * ONE_KIBI_BYTE,

      eventRateLimiterThreshold: 3000,

      /**
       * flush automatically, aim to be lower than ALB connection timeout
       * to maximize connection reuse.
       */
      flushTimeout: 30 * ONE_SECOND,

      /**
       * Logs intake limit
       */
      batchMessagesLimit: 50,
      messageBytesLimit: 256 * ONE_KIBI_BYTE,
    },
    computeTransportConfiguration(initConfiguration)
  )
}

export function buildCookieOptions(initConfiguration) {
  var cookieOptions = {}

  cookieOptions.secure = mustUseSecureCookie(initConfiguration)
  cookieOptions.crossSite = !!initConfiguration.useCrossSiteSessionCookie

  if (initConfiguration.trackSessionAcrossSubdomains) {
    cookieOptions.domain = getCurrentSite()
  }

  return cookieOptions
}

function mustUseSecureCookie(initConfiguration) {
  return !!initConfiguration.useSecureSessionCookie || !!initConfiguration.useCrossSiteSessionCookie
}
