import {
  BoundedBuffer,
  createContextManager,
  makePublicApi,
  display,
  deepClone,
  timeStampNow,
} from '@cloudcare/browser-core'
import { validateAndBuildLogsConfiguration } from '../domain/configuration'
import { Logger } from '../domain/logger'

export function makeLogsPublicApi(startLogsImpl) {
  var isAlreadyInitialized = false

  var globalContextManager = createContextManager()
  var customLoggers = {}
  var getInternalContextStrategy = function() {
    return undefined
  }

  var beforeInitLoggerLog = new BoundedBuffer()

  var handleLogStrategy = function(
    logsMessage,
    logger,
    savedCommonContext,
    date
  ){
    if (typeof savedCommonContext === 'undefined') {
      savedCommonContext = deepClone(getCommonContext())
    }
    if (typeof date === 'undefined') {
      date = timeStampNow()
    }
    beforeInitLoggerLog.add(function() {
      return handleLogStrategy(logsMessage, logger, savedCommonContext, date)
    })
  }

  var getInitConfigurationStrategy = function() {
    return undefined
  }

  var mainLogger = new Logger(function() {
    return handleLogStrategy.apply(this, arguments)
  })

  function getCommonContext() {
    return {
      view: {
        referrer: document.referrer,
        url: window.location.href,
      },
      context: globalContextManager.get(),
    }
  }

  return makePublicApi({
    logger: mainLogger,

    init: function(initConfiguration) {
      if (!canInitLogs(initConfiguration)) {
        return
      }

      var configuration = validateAndBuildLogsConfiguration(initConfiguration)
      if (!configuration) {
        return
      }
      var _startLogsImpl = startLogsImpl(configuration, getCommonContext, mainLogger)
      handleLogStrategy = _startLogsImpl.handleLog
      getInternalContextStrategy = _startLogsImpl.getInternalContext
      getInitConfigurationStrategy = function() {
        return deepClone(initConfiguration)
      }
      beforeInitLoggerLog.drain()

      isAlreadyInitialized = true
    },

    /** @deprecated: use getGlobalContext instead */
    getGlobalContext: globalContextManager.getContext,

    /** @deprecated: use setGlobalContext instead */
    setGlobalContext: globalContextManager.setContext,

    /** @deprecated: use setGlobalContextProperty instead */
    setGlobalContextProperty: globalContextManager.setContextProperty,

    /** @deprecated: use removeGlobalContextProperty instead */
    removeGlobalContextProperty: globalContextManager.removeContextProperty,

    clearGlobalContext: globalContextManager.clearContext,

    createLogger: function(name, conf){
      if (typeof conf == 'undefined') {
        conf = {}
      }
      customLoggers[name] = new Logger(
        function() {
          return handleLogStrategy(this. arguments)
        },
        name,
        conf.handler,
        conf.level,
        conf.context
      )
      return customLoggers[name]
    },

    getLogger: function(name) {
      return customLoggers[name]
    },

    getInitConfiguration: function() {
      return getInitConfigurationStrategy()
    },

    getInternalContext: function(startTime) {
      return getInternalContextStrategy(startTime)
    },
  })


  function canInitLogs(initConfiguration) {
    if (isAlreadyInitialized) {
      if (!initConfiguration.silentMultipleInit) {
        display.error('DD_LOGS is already initialized.')
      }
      return false
    }
    if (!initConfiguration.datakitUrl && !initConfiguration.datakitOrigin) {
      display.error(
        'datakitOrigin is not configured, no RUM data will be collected.'
      )
      return false
    }
    return true
  }
}
