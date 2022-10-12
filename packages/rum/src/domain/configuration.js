import {
  assign,
  display,
  isPercentage,
  validateAndBuildConfiguration,
  isArray,
  TraceType,
  isNullUndefinedDefaultValue
} from '@cloudcare/browser-core'
import { buildEnv } from '../boot/buildEnv'


export function validateAndBuildRumConfiguration(
  initConfiguration
) {
  if (!initConfiguration.applicationId) {
    display.error('Application ID is not configured, no RUM data will be collected.')
    return
  }
  if (!initConfiguration.datakitUrl && !initConfiguration.datakitOrigin) {
    display.error(
      'datakitOrigin is not configured, no RUM data will be collected.'
    )
    return false
  }
  // TODO remove fallback in next major
  if (initConfiguration.sessionReplaySampleRate !== undefined && !isPercentage(initConfiguration.sessionReplaySampleRate)) {
    display.error('Premium Sample Rate should be a number between 0 and 100')
    return
  }

  if (initConfiguration.allowedTracingOrigins !== undefined) {
    if (!isArray(initConfiguration.allowedTracingOrigins)) {
      display.error('Allowed Tracing Origins should be an array')
      return
    }
   
  }

  if (initConfiguration.excludedActivityUrls !== undefined && !isArray(initConfiguration.excludedActivityUrls)) {
    display.error('Excluded Activity Urls should be an array')
    return
  }

  var baseConfiguration = validateAndBuildConfiguration(initConfiguration)
  if (!baseConfiguration) {
    return
  }

  var trackFrustrations = !!initConfiguration.trackFrustrations

  return assign(
    {
      applicationId: initConfiguration.applicationId,
      actionNameAttribute: initConfiguration.actionNameAttribute,
      sessionReplaySampleRate: isNullUndefinedDefaultValue(initConfiguration.sessionReplaySampleRate, 100),
      allowedTracingOrigins: isNullUndefinedDefaultValue(initConfiguration.allowedTracingOrigins,[]),
      excludedActivityUrls: isNullUndefinedDefaultValue(initConfiguration.excludedActivityUrls, []),
      trackInteractions: !!initConfiguration.trackInteractions || trackFrustrations,
      trackFrustrations: trackFrustrations,
      trackViewsManually: !!initConfiguration.trackViewsManually,
      traceType: isNullUndefinedDefaultValue(initConfiguration.traceType, TraceType.DDTRACE),
      traceId128Bit: !!initConfiguration.traceId128Bit,
      isJsBirdge: !!initConfiguration.isJsBirdge,// 是否需要对webview 发送数据，需要装我们对应ios sdk
    },
    baseConfiguration,
    buildEnv
  )
}
