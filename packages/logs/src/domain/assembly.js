import {
  ErrorSource,
  extend2Lev,
  createEventRateLimiter,
  getRelativeTime,
  withSnakeCaseKeys,
  LifeCycleEventType,
  deviceInfo,
  each,
  RumEventType,
  isNullUndefinedDefaultValue
} from '@cloudcare/browser-core'

import { STATUSES, HandlerType } from './logger'
import { isAuthorized } from './logsCollection/logger/loggerCollection'

export function startLogsAssembly(
  sessionManager,
  configuration,
  lifeCycle,
  getCommonContext,
  mainLogger,
  reportError
) {
  var statusWithCustom = STATUSES.concat(['custom'])
  var logRateLimiters = {}
  each(statusWithCustom, function(status) {
    logRateLimiters[status] = createEventRateLimiter(status, configuration.eventRateLimiterThreshold, reportError)
  })
  lifeCycle.subscribe(
    LifeCycleEventType.RAW_LOG_COLLECTED,
    function(data) {
      // { rawLogsEvent, messageContext = undefined, savedCommonContext = undefined, logger = mainLogger }
      var rawLogsEvent = data.rawLogsEvent
      var messageContext = data.messageContext || undefined
      var savedCommonContext = data.messageContext || undefined
      var logger = data.logger || mainLogger
      var startTime = getRelativeTime(rawLogsEvent.date)
      var session = sessionManager.findTrackedSession(startTime)

      if (!session) {
        return
      }
      var commonContext = savedCommonContext || getCommonContext()
      var log = extend2Lev(
        { 
          service: configuration.service || 'browser', 
          env: configuration.env || '',
          version: configuration.version || '',
          _dd: {
            sdkName: configuration.sdkName,
            sdkVersion: configuration.sdkVersion,
          },
          session: {
            id: session.id
          }, 
          view: commonContext.view,
          device: deviceInfo,
          type: RumEventType.LOGGER
        },
        commonContext.context,
        getRUMInternalContext(startTime),
        rawLogsEvent,
        logger.getContext(),
        messageContext
      )

      if (
        // Todo: [RUMF-1230] Move this check to the logger collection in the next major release
        !isAuthorized(rawLogsEvent.status, HandlerType.http, logger) || (configuration.beforeSend && configuration.beforeSend(log) === false)
        ||
        (
          log.error 
          && 
          log.error.origin !== ErrorSource.AGENT 
          &&
          isNullUndefinedDefaultValue(logRateLimiters[log.status], logRateLimiters['custom']).isLimitReached()
        )
      ) {
        return
      }

      lifeCycle.notify(LifeCycleEventType.LOG_COLLECTED, withSnakeCaseKeys(log))
    }
  )
}


export function getRUMInternalContext(startTime) {
  return getInternalContextFromRumGlobal(window.DATAFLUX_RUM)

  function getInternalContextFromRumGlobal(rumGlobal) {
    if (rumGlobal && rumGlobal.getInternalContext) {
      return rumGlobal.getInternalContext(startTime)
    }
  }
}

export function resetRUMInternalContext() {
  logsSentBeforeRumInjectionTelemetryAdded = false
}
