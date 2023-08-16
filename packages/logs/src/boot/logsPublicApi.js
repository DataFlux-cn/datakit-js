import {
  BoundedBuffer,
  createContextManager,
  makePublicApi,
  CustomerDataType,
  display,
  deepClone,
  timeStampNow,
  checkUser,
  sanitizeUser,
  monitor
} from '@cloudcare/browser-core'
import { validateAndBuildLogsConfiguration } from '../domain/configuration'
import { Logger } from '../domain/logger'

export function makeLogsPublicApi(startLogsImpl) {
  var isAlreadyInitialized = false

  var globalContextManager = createContextManager(
    CustomerDataType.GlobalContext
  )
  var userContextManager = createContextManager(CustomerDataType.User)
  var customLoggers = {}
  var getInternalContextStrategy = function () {
    return undefined
  }

  var beforeInitLoggerLog = new BoundedBuffer()

  var handleLogStrategy = function (
    logsMessage,
    logger,
    savedCommonContext,
    date
  ) {
    if (typeof savedCommonContext === 'undefined') {
      savedCommonContext = deepClone(buildCommonContext())
    }
    if (typeof date === 'undefined') {
      date = timeStampNow()
    }
    beforeInitLoggerLog.add(function () {
      return handleLogStrategy(logsMessage, logger, savedCommonContext, date)
    })
  }

  var getInitConfigurationStrategy = function () {
    return undefined
  }

  var mainLogger = new Logger(function () {
    return handleLogStrategy.apply(this, arguments)
  })

  function buildCommonContext() {
    return {
      view: {
        referrer: document.referrer,
        url: window.location.href
      },
      context: globalContextManager.getContext(),
      user: userContextManager.getContext()
    }
  }

  return makePublicApi({
    logger: mainLogger,

    init: monitor(function (initConfiguration) {
      if (!canInitLogs(initConfiguration)) {
        return
      }

      var configuration = validateAndBuildLogsConfiguration(initConfiguration)
      if (!configuration) {
        return
      }
      var _startLogsImpl = startLogsImpl(
        configuration,
        buildCommonContext,
        mainLogger
      )
      handleLogStrategy = _startLogsImpl.handleLog
      getInternalContextStrategy = _startLogsImpl.getInternalContext
      getInitConfigurationStrategy = function () {
        return deepClone(initConfiguration)
      }
      beforeInitLoggerLog.drain()

      isAlreadyInitialized = true
    }),

    /** @deprecated: use getGlobalContext instead */
    getGlobalContext: monitor(globalContextManager.getContext),

    /** @deprecated: use setGlobalContext instead */
    setGlobalContext: monitor(globalContextManager.setContext),

    /** @deprecated: use setGlobalContextProperty instead */
    setGlobalContextProperty: monitor(globalContextManager.setContextProperty),

    /** @deprecated: use removeGlobalContextProperty instead */
    removeGlobalContextProperty: monitor(
      globalContextManager.removeContextProperty
    ),

    clearGlobalContext: monitor(globalContextManager.clearContext),

    createLogger: monitor(function (name, conf) {
      if (typeof conf == 'undefined') {
        conf = {}
      }
      customLoggers[name] = new Logger(
        function () {
          return handleLogStrategy(this.arguments)
        },
        name,
        conf.handler,
        conf.level,
        conf.context
      )
      return customLoggers[name]
    }),

    getLogger: monitor(function (name) {
      return customLoggers[name]
    }),

    getInitConfiguration: monitor(function () {
      return getInitConfigurationStrategy()
    }),

    getInternalContext: monitor(function (startTime) {
      return getInternalContextStrategy(startTime)
    }),
    setUser: monitor(function (newUser) {
      if (checkUser(newUser)) {
        userContextManager.setContext(sanitizeUser(newUser))
      }
    }),
    getUser: monitor(userContextManager.getContext),
    removeUserProperty: monitor(userContextManager.removeContextProperty),
    clearUser: monitor(userContextManager.clearContext)
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
