import {
  includes,
  display,
  extend2Lev,
  ErrorSource,
  timeStampNow,
  LifeCycleEventType,
  isArray
} from '@cloudcare/browser-core'
import { StatusType, HandlerType } from '../../logger'

export var STATUS_PRIORITIES = {
  [StatusType.debug]: 0,
  [StatusType.info]: 1,
  [StatusType.warn]: 2,
  [StatusType.error]: 3
}

export function startLoggerCollection(lifeCycle) {
  function handleLog(logsMessage, logger, savedCommonContext, savedDate) {
    var messageContext = logsMessage.context
    if (isAuthorized(logsMessage.status, HandlerType.console, logger)) {
      display(
        logsMessage.status,
        logsMessage.message,
        extend2Lev(logger.getContext(), messageContext)
      )
    }
    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: {
        date: savedDate || timeStampNow(),
        message: logsMessage.message,
        status: logsMessage.status,
        origin: ErrorSource.LOGGER
      },
      messageContext: messageContext,
      savedCommonContext: savedCommonContext,
      logger: logger
    })
  }

  return {
    handleLog: handleLog
  }
}

export function isAuthorized(status, handlerType, logger) {
  var loggerHandler = logger.getHandler()
  var sanitizedHandlerType = isArray(loggerHandler)
    ? loggerHandler
    : [loggerHandler]
  return (
    STATUS_PRIORITIES[status] >= STATUS_PRIORITIES[logger.getLevel()] &&
    includes(sanitizedHandlerType, handlerType)
  )
}
