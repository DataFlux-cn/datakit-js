import {
  assign,
  extend2Lev,
  createContextManager,
  ErrorSource,
  keys,
  CustomerDataType,
  sanitize,
  computeStackTrace,
  computeRawError,
  clocksNow,
  ErrorHandling,
  monitor,
  NonErrorPrefix
} from '@cloudcare/browser-core'

export var StatusType = {
  debug: 'debug',
  error: 'error',
  info: 'info',
  warn: 'warn',
  critical: 'critical'
}

export var HandlerType = {
  console: 'console',
  http: 'http',
  silent: 'silent'
}

export var STATUSES = keys(StatusType)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export function Logger(
  handleLogStrategy,
  name,
  handlerType,
  level,
  loggerContext
) {
  this.contextManager = createContextManager(CustomerDataType.LoggerContext)
  if (typeof handlerType === 'undefined') {
    handlerType = HandlerType.http
  }
  if (typeof level === 'undefined') {
    level = StatusType.debug
  }
  if (typeof loggerContext === 'undefined') {
    loggerContext = {}
  }
  this.handleLogStrategy = handleLogStrategy
  this.handlerType = handlerType
  this.level = level
  this.contextManager.set(
    assign({}, loggerContext, name ? { logger: { name: name } } : undefined)
  )
}
Logger.prototype = {
  log: monitor(function (message, messageContext, status, error) {
    if (typeof status === 'undefined') {
      status = StatusType.info
    }
    var errorContext
    if (status === StatusType.error) {
      // Always add origin if status is error (backward compatibility - Remove in next major)
      errorContext = { origin: ErrorSource.LOGGER }
    }
    if (error !== undefined && error !== null) {
      var stackTrace =
        error instanceof Error ? computeStackTrace(error) : undefined
      var rawError = computeRawError({
        stackTrace: stackTrace,
        originalError: error,
        nonErrorPrefix: NonErrorPrefix.PROVIDED,
        source: ErrorSource.LOGGER,
        handling: ErrorHandling.HANDLED,
        startClocks: clocksNow()
      })

      errorContext = {
        origin: ErrorSource.LOGGER, // Remove in next major
        stack: rawError.stack,
        kind: rawError.type,
        message: rawError.message
      }
    }

    var sanitizedMessageContext = sanitize(messageContext)

    var context = errorContext
      ? extend2Lev({ error: errorContext }, sanitizedMessageContext)
      : sanitizedMessageContext

    this.handleLogStrategy(
      { message: message, context: context, status: status },
      this
    )
  }),

  debug: function (message, messageContext, error) {
    this.log(message, messageContext, StatusType.debug, error)
  },

  info: function (message, messageContext, error) {
    this.log(message, messageContext, StatusType.info, error)
  },

  warn: function (message, messageContext, error) {
    this.log(message, messageContext, StatusType.warn, error)
  },
  critical: function (message, messageContext, error) {
    this.log(message, messageContext, StatusType.critical, error)
  },
  error: function (message, messageContext, error) {
    var errorOrigin = {
      error: {
        origin: ErrorSource.LOGGER
      }
    }
    this.log(
      message,
      extend2Lev(errorOrigin, messageContext),
      StatusType.error,
      error
    )
  },

  setContext: function (context) {
    this.contextManager.set(context)
  },

  getContext: function () {
    return this.contextManager.get()
  },

  addContext: function (key, value) {
    this.contextManager.add(key, value)
  },

  removeContext: function (key) {
    this.contextManager.remove(key)
  },

  setHandler: function (handler) {
    this.handlerType = handler
  },

  getHandler: function () {
    return this.handlerType
  },
  setLevel: function (level) {
    this.level = level
  },
  getLevel: function () {
    return this.level
  }
}
