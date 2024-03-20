import {
  assign,
  display,
  isPercentage,
  validateAndBuildConfiguration,
  validatePostRequestRequireParamsConfiguration,
  isArray,
  TraceType,
  isNullUndefinedDefaultValue,
  DefaultPrivacyLevel,
  objectHasValue,
  isMatchOption,
  getOrigin,
  each
} from '@cloudcare/browser-core'
import { buildEnv } from '../boot/buildEnv'
import { isTracingOption } from '../domain/tracing/tracer'

export function validateAndBuildRumConfiguration(initConfiguration) {
  if (!initConfiguration.applicationId) {
    display.error(
      'Application ID is not configured, no RUM data will be collected.'
    )
    return
  }
  var requireParamsValidate =
    validatePostRequestRequireParamsConfiguration(initConfiguration)
  if (!requireParamsValidate) return
  // TODO remove fallback in next major
  if (
    initConfiguration.sessionReplaySampleRate !== undefined &&
    !isPercentage(initConfiguration.sessionReplaySampleRate)
  ) {
    display.error('Premium Sample Rate should be a number between 0 and 100')
    return
  }
  var allowedTracingUrls = validateAndBuildTracingOptions(initConfiguration)
  if (!allowedTracingUrls) {
    return
  }
  //   if (initConfiguration.allowedTracingOrigins !== undefined) {
  //     if (!isArray(initConfiguration.allowedTracingOrigins)) {
  //       display.error('Allowed Tracing Origins should be an array')
  //       return
  //     }
  //   }
  //   if (initConfiguration.allowedDDTracingOrigins !== undefined) {
  //     if (!isArray(initConfiguration.allowedDDTracingOrigins)) {
  //       display.error('Allowed Tracing Origins should be an array')
  //       return
  //     }
  //   }
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

  return assign(
    {
      applicationId: initConfiguration.applicationId,
      actionNameAttribute: initConfiguration.actionNameAttribute,
      sessionReplaySampleRate: isNullUndefinedDefaultValue(
        initConfiguration.sessionReplaySampleRate,
        100
      ),
      tracingSampleRate: initConfiguration.tracingSampleRate,
      allowedTracingUrls: allowedTracingUrls,
      excludedActivityUrls: isNullUndefinedDefaultValue(
        initConfiguration.excludedActivityUrls,
        []
      ),
      trackUserInteractions: trackUserInteractions,
      trackViewsManually: !!initConfiguration.trackViewsManually,
      traceType: isNullUndefinedDefaultValue(
        initConfiguration.traceType,
        TraceType.DDTRACE
      ),
      traceId128Bit: !!initConfiguration.traceId128Bit,
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
/**
 * Handles allowedTracingUrls and processes legacy allowedTracingOrigins
 */
function validateAndBuildTracingOptions(initConfiguration) {
  // Advise about parameters precedence.
  if (
    initConfiguration.allowedTracingUrls !== undefined &&
    initConfiguration.allowedTracingOrigins !== undefined
  ) {
    display.warn(
      'Both allowedTracingUrls and allowedTracingOrigins (deprecated) have been defined. The parameter allowedTracingUrls will override allowedTracingOrigins.'
    )
  }
  // Handle allowedTracingUrls first
  if (initConfiguration.allowedTracingUrls !== undefined) {
    if (!isArray(initConfiguration.allowedTracingUrls)) {
      display.error('Allowed Tracing URLs should be an array')
      return
    }
    // if (initConfiguration.allowedTracingUrls.length !== 0 && initConfiguration.service === undefined) {
    //   display.error('Service needs to be configured when tracing is enabled')
    //   return
    // }
    // Convert from (MatchOption | TracingOption) to TracingOption, remove unknown properties
    var tracingOptions = []
    each(initConfiguration.allowedTracingUrls, function (option) {
      if (isMatchOption(option)) {
        tracingOptions.push({
          match: option,
          traceType: isNullUndefinedDefaultValue(
            initConfiguration.traceType,
            TraceType.DDTRACE
          )
        })
      } else if (isTracingOption(option)) {
        tracingOptions.push(option)
      } else {
        display.warn(
          'Allowed Tracing Urls parameters should be a string, RegExp, function, or an object. Ignoring parameter',
          option
        )
      }
    })
    return tracingOptions
  }

  // Handle conversion of allowedTracingOrigins to allowedTracingUrls
  if (initConfiguration.allowedTracingOrigins !== undefined) {
    if (!isArray(initConfiguration.allowedTracingOrigins)) {
      display.error('Allowed Tracing Origins should be an array')
      return
    }

    var tracingOptions = []
    each(initConfiguration.allowedTracingOrigins, function (legacyMatchOption) {
      var tracingOption = convertLegacyMatchOptionToTracingOption(
        legacyMatchOption,
        isNullUndefinedDefaultValue(
          initConfiguration.traceType,
          TraceType.DDTRACE
        )
      )
      if (tracingOption) {
        tracingOptions.push(tracingOption)
      }
    })

    return tracingOptions
  }
  // Handle conversion of allowedDDTracingOrigins to allowedTracingUrls
  if (initConfiguration.allowedDDTracingOrigins !== undefined) {
    if (!isArray(initConfiguration.allowedDDTracingOrigins)) {
      display.error('Allowed Tracing Origins should be an array')
      return
    }

    var tracingOptions = []
    each(
      initConfiguration.allowedDDTracingOrigins,
      function (legacyMatchOption) {
        var tracingOption = convertLegacyMatchOptionToTracingOption(
          legacyMatchOption,
          isNullUndefinedDefaultValue(
            initConfiguration.traceType,
            TraceType.DDTRACE
          )
        )
        if (tracingOption) {
          tracingOptions.push(tracingOption)
        }
      }
    )

    return tracingOptions
  }

  return []
}

/**
 * Converts parameters from the deprecated allowedTracingOrigins
 * to allowedTracingUrls. Handles the change from origin to full URLs.
 */
function convertLegacyMatchOptionToTracingOption(item, traceType) {
  var match
  if (typeof item === 'string') {
    match = item
  } else if (item instanceof RegExp) {
    match = function (url) {
      return item.test(getOrigin(url))
    }
  } else if (typeof item === 'function') {
    match = function (url) {
      return item(getOrigin(url))
    }
  }

  if (match === undefined) {
    display.warn(
      'Allowed Tracing Origins parameters should be a string, RegExp or function. Ignoring parameter',
      item
    )
    return undefined
  }

  return { match: match, traceType: traceType }
}
