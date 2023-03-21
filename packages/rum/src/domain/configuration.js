import {
  assign,
  display,
  isPercentage,
  validateAndBuildConfiguration,
  isArray,
  TraceType,
  isNullUndefinedDefaultValue,
  DefaultPrivacyLevel,
  objectHasValue
} from '@cloudcare/browser-core'
import { buildEnv } from '../boot/buildEnv'

export function validateAndBuildRumConfiguration(initConfiguration) {
  if (!initConfiguration.applicationId) {
    display.error(
      'Application ID is not configured, no RUM data will be collected.'
    )
    return
  }
  if (!initConfiguration.datakitUrl && !initConfiguration.datakitOrigin) {
    display.error(
      'datakitOrigin is not configured, no RUM data will be collected.'
    )
    return false
  }
  // TODO remove fallback in next major
  if (
    initConfiguration.sessionReplaySampleRate !== undefined &&
    !isPercentage(initConfiguration.sessionReplaySampleRate)
  ) {
    display.error('Premium Sample Rate should be a number between 0 and 100')
    return
  }

  if (initConfiguration.allowedTracingOrigins !== undefined) {
    if (!isArray(initConfiguration.allowedTracingOrigins)) {
      display.error('Allowed Tracing Origins should be an array')
      return
    }
  }
  if (initConfiguration.allowedDDTracingOrigins !== undefined) {
    if (!isArray(initConfiguration.allowedDDTracingOrigins)) {
      display.error('Allowed Tracing Origins should be an array')
      return
    }
  }
  if (
    initConfiguration.tracingSampleRate !== undefined &&
    !isPercentage(initConfiguration.tracingSampleRate)
  ) {
    display.error('Tracing Sample Rate should be a number between 0 and 100')
    return
  }
  if (
    initConfiguration.excludedActivityUrls !== undefined &&
    !isArray(initConfiguration.excludedActivityUrls)
  ) {
    display.error('Excluded Activity Urls should be an array')
    return
  }

  var baseConfiguration = validateAndBuildConfiguration(initConfiguration)
  if (!baseConfiguration) {
    return
  }
  var trackUserInteractions = !!isNullUndefinedDefaultValue(
    initConfiguration.trackUserInteractions,
    initConfiguration.trackInteractions
  )
  var trackFrustrations = !!initConfiguration.trackFrustrations

  return assign(
    {
      applicationId: initConfiguration.applicationId,
      actionNameAttribute: initConfiguration.actionNameAttribute,
      sessionReplaySampleRate: isNullUndefinedDefaultValue(
        initConfiguration.sessionReplaySampleRate,
        100
      ),
      tracingSampleRate: initConfiguration.tracingSampleRate,
      allowedTracingOrigins: isNullUndefinedDefaultValue(
        initConfiguration.allowedTracingOrigins ||
          initConfiguration.allowedDDTracingOrigins,
        []
      ),
      excludedActivityUrls: isNullUndefinedDefaultValue(
        initConfiguration.excludedActivityUrls,
        []
      ),
      trackUserInteractions: trackUserInteractions || trackFrustrations,
      trackFrustrations: trackFrustrations,
      trackViewsManually: !!initConfiguration.trackViewsManually,
      traceType: isNullUndefinedDefaultValue(
        initConfiguration.traceType,
        TraceType.DDTRACE
      ),
      traceId128Bit: !!initConfiguration.traceId128Bit,
      isJsBirdge: !!initConfiguration.isJsBirdge, // 是否需要对webview 发送数据，需要装我们对应ios sdk
      defaultPrivacyLevel: objectHasValue(
        DefaultPrivacyLevel,
        initConfiguration.defaultPrivacyLevel
      )
        ? initConfiguration.defaultPrivacyLevel
        : DefaultPrivacyLevel.MASK_USER_INPUT
    },
    baseConfiguration,
    buildEnv
  )
}
