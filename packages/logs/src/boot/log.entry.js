import {
  isPercentage,
  createContextManager,
  extend,
  replaceNumberCharByPath,
  getQueryParamsFromUrl,
  jsonStringify,
  BoundedBuffer,
  makePublicApi,
  defineGlobal,
  getGlobalObject,
  extend2Lev
} from '@cloudcare/browser-core'
import { startLogs } from './log'
import { Logger } from '../domain/logger'

export var datafluxLogs = makeLogsPublicApi(startLogs)

defineGlobal(getGlobalObject(), 'DATAFLUX_LOGS', datafluxLogs)

export function makeLogsPublicApi(startLogsImpl) {
  var isAlreadyInitialized = false

  var globalContextManager = createContextManager()
  var customLoggers = {}

  var beforeInitSendLog = new BoundedBuffer()
  var sendLogStrategy = function (message, currentContext) {
    beforeInitSendLog.add([message, currentContext])
  }
  var logger = new Logger(sendLog)

  return makePublicApi({
    logger: logger,
    init: function (userConfiguration) {
      if (!canInitLogs(userConfiguration)) {
        return
      }
      sendLogStrategy = startLogsImpl(
        userConfiguration,
        logger,
        globalContextManager.get
      )
      beforeInitSendLog.drain(function ([message, context]) {
        return sendLogStrategy(message, context)
      })
      isAlreadyInitialized = true
    },

    getLoggerGlobalContext: globalContextManager.get,
    setLoggerGlobalContext: globalContextManager.set,

    addLoggerGlobalContext: globalContextManager.add,

    removeLoggerGlobalContext: globalContextManager.remove,

    createLogger: function (name, conf) {
      if (typeof conf === 'undefined') {
        conf = {}
      }
      customLoggers[name] = new Logger(
        sendLog,
        conf.handler,
        conf.level,
        extend({}, conf.context, {
          logger: { name: name }
        })
      )
      return customLoggers[name]
    },

    getLogger: function (name) {
      return customLoggers[name]
    }
  })

  function canInitLogs(userConfiguration) {
    if (isAlreadyInitialized) {
      if (!userConfiguration.silentMultipleInit) {
        console.error('DATAFLUX_LOGS is already initialized.')
      }
      return false
    }
    if (!userConfiguration.datakitUrl && !userConfiguration.datakitOrigin) {
      console.error(
        'datakitOrigin is not configured, no RUM data will be collected.'
      )
      return false
    }
    if (
      userConfiguration.sampleRate !== undefined &&
      !isPercentage(userConfiguration.sampleRate)
    ) {
      console.error('Sample Rate should be a number between 0 and 100')
      return false
    }
    return true
  }

  function sendLog(message) {
    sendLogStrategy(
      message,
      extend2Lev(
        {
          date: new Date().getTime(),
          view: {
            referrer: document.referrer,
            url: window.location.href,
            host: window.location.host,
            path: window.location.pathname,
            pathGroup: replaceNumberCharByPath(window.location.pathname),
            urlQuery: jsonStringify(getQueryParamsFromUrl(window.location.href))
          }
        },
        globalContextManager.get()
      )
    )
  }
}
