import {
  deepClone,
  assign,
  extend2Lev,
  createContextManager,
  ErrorSource,
  keys,
  CustomerDataType
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
  log: function (message, messageContext, status) {
    if (typeof status === 'undefined') {
      status = StatusType.info
    }
    this.handleLogStrategy(
      { message: message, context: deepClone(messageContext), status: status },
      this
    )
  },

  debug: function (message, messageContext) {
    this.log(message, messageContext, StatusType.debug)
  },

  info: function (message, messageContext) {
    this.log(message, messageContext, StatusType.info)
  },

  warn: function (message, messageContext) {
    this.log(message, messageContext, StatusType.warn)
  },
  critical: function (message, messageContext) {
    this.log(message, messageContext, StatusType.critical)
  },
  error: function (message, messageContext) {
    var errorOrigin = {
      error: {
        origin: ErrorSource.LOGGER
      }
    }
    this.log(message, extend2Lev(errorOrigin, messageContext), StatusType.error)
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
