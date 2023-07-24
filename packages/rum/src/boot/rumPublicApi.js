import {
  makePublicApi,
  areCookiesAuthorized,
  BoundedBuffer,
  display,
  buildCookieOptions,
  createContextManager,
  CustomerDataType,
  clocksNow,
  timeStampNow,
  ActionType,
  deepClone,
  createHandlingStack,
  sanitizeUser,
  checkUser,
  noop,
  assign,
  canUseEventBridge
} from '@cloudcare/browser-core'
import { validateAndBuildRumConfiguration } from '../domain/configuration'
import { buildCommonContext } from '../domain/contexts/commonContext'
export function makeRumPublicApi(startRumImpl, recorderApi) {
  var isAlreadyInitialized = false

  var globalContextManager = createContextManager(
    CustomerDataType.GlobalContext
  )
  var userContextManager = createContextManager(CustomerDataType.User)

  var getInternalContextStrategy = function () {
    return undefined
  }
  var getInitConfigurationStrategy = function () {
    return undefined
  }
  var stopSessionStrategy = function () {
    return noop()
  }
  var bufferApiCalls = new BoundedBuffer()
  var addTimingStrategy = function (name, time) {
    if (typeof time === 'undefined') {
      time = timeStampNow()
    }
    bufferApiCalls.add(function () {
      return addTimingStrategy(name, time)
    })
  }
  var startViewStrategy = function (options, startClocks) {
    if (typeof startClocks === 'undefined') {
      startClocks = clocksNow()
    }
    bufferApiCalls.add(function () {
      return startViewStrategy(options, startClocks)
    })
  }
  var addActionStrategy = function (action, commonContext) {
    if (typeof commonContext == 'undefined') {
      commonContext = buildCommonContext(
        globalContextManager,
        userContextManager,
        recorderApi
      )
    }
    bufferApiCalls.add(function () {
      return addActionStrategy(action, commonContext)
    })
  }
  var addErrorStrategy = function (providedError, commonContext) {
    if (typeof commonContext == 'undefined') {
      commonContext = buildCommonContext(
        globalContextManager,
        userContextManager,
        recorderApi
      )
    }
    bufferApiCalls.add(function () {
      return addErrorStrategy(providedError, commonContext)
    })
  }

  function initRum(initConfiguration) {
    getInitConfigurationStrategy = function () {
      return deepClone(initConfiguration)
    }
    var eventBridgeAvailable = canUseEventBridge()
    if (eventBridgeAvailable) {
      initConfiguration = overrideInitConfigurationForBridge(initConfiguration)
    }
    if (!canHandleSession(initConfiguration)) {
      return
    }

    if (!canInitRum(initConfiguration)) {
      return
    }

    var configuration = validateAndBuildRumConfiguration(initConfiguration)
    if (!configuration) {
      return
    }

    if (!configuration.trackViewsManually) {
      doStartRum(configuration)
    } else {
      // drain beforeInitCalls by buffering them until we start RUM
      // if we get a startView, drain re-buffered calls before continuing to drain beforeInitCalls
      // in order to ensure that calls are processed in order
      var beforeInitCalls = bufferApiCalls
      bufferApiCalls = new BoundedBuffer()

      startViewStrategy = function (options) {
        doStartRum(configuration, options)
      }
      beforeInitCalls.drain()
    }

    isAlreadyInitialized = true
  }
  function doStartRum(configuration, initialViewOptions) {
    var startRumResults = startRumImpl(
      configuration,
      recorderApi,
      globalContextManager,
      userContextManager,
      initialViewOptions
    )
    startViewStrategy = startRumResults.startView
    addActionStrategy = startRumResults.addAction
    addErrorStrategy = startRumResults.addError
    addTimingStrategy = startRumResults.addTiming
    getInternalContextStrategy = startRumResults.getInternalContext
    stopSessionStrategy = startRumResults.stopSession
    bufferApiCalls.drain()
    recorderApi.onRumStart(
      startRumResults.lifeCycle,
      configuration,
      startRumResults.session,
      startRumResults.viewContexts
    )
  }
  var startView = function (options) {
    var sanitizedOptions =
      typeof options === 'object' ? options : { name: options }
    startViewStrategy(sanitizedOptions)
  }
  var rumPublicApi = makePublicApi({
    init: initRum,
    /** @deprecated: use setGlobalContextProperty instead */
    addRumGlobalContext: globalContextManager.add,
    setGlobalContextProperty: globalContextManager.setContextProperty,

    /** @deprecated: use removeGlobalContextProperty instead */
    removeRumGlobalContext: globalContextManager.remove,
    removeGlobalContextProperty: globalContextManager.removeContextProperty,

    /** @deprecated: use getGlobalContext instead */
    getRumGlobalContext: globalContextManager.get,
    getGlobalContext: globalContextManager.getContext,

    /** @deprecated: use setGlobalContext instead */
    setRumGlobalContext: globalContextManager.set,
    setGlobalContext: globalContextManager.setContext,

    clearGlobalContext: globalContextManager.clearContext,

    getInitConfiguration: function () {
      return getInitConfigurationStrategy()
    },
    getInternalContext: function (startTime) {
      return getInternalContextStrategy(startTime)
    },
    addDebugSession: function (id) {},
    clearDebugSession: function () {},
    getDebugSession: function () {},
    addAction: function (name, context) {
      addActionStrategy({
        name: name,
        context: deepClone(context),
        startClocks: clocksNow(),
        type: ActionType.CUSTOM
      })
    },
    addError: function (error, context) {
      var handlingStack = createHandlingStack()
      addErrorStrategy({
        error: error,
        handlingStack: handlingStack,
        context: deepClone(context),
        startClocks: clocksNow()
      })
    },
    addTiming: function (name, time) {
      addTimingStrategy(name, time)
    },
    setUser: function (newUser) {
      if (checkUser(newUser)) {
        userContextManager.setContext(sanitizeUser(newUser))
      }
    },
    getUser: userContextManager.getContext,
    setUserProperty: function (key, property) {
      var newUser = {}
      newUser[key] = property
      var sanitizedProperty = sanitizeUser(newUser)[key]
      userContextManager.setContextProperty(key, sanitizedProperty)
    },
    removeUserProperty: userContextManager.removeContextProperty,

    /** @deprecated: renamed to clearUser */
    removeUser: userContextManager.clearContext,
    clearUser: userContextManager.clearContext,
    startView: startView,
    stopSession: function () {
      stopSessionStrategy()
    },
    startSessionReplayRecording: recorderApi.start,
    stopSessionReplayRecording: recorderApi.stop
  })
  return rumPublicApi
  function canHandleSession(initConfiguration) {
    if (!areCookiesAuthorized(buildCookieOptions(initConfiguration))) {
      display.warn('Cookies are not authorized, we will not send any data.')
      return false
    }

    if (isLocalFile()) {
      display.error('Execution is not allowed in the current context.')
      return false
    }
    return true
  }
  function canInitRum(initConfiguration) {
    if (isAlreadyInitialized) {
      if (!initConfiguration.silentMultipleInit) {
        display.error('DATAFLUX_RUM is already initialized.')
      }
      return false
    }
    return true
  }
  function isLocalFile() {
    return window.location.protocol === 'file:'
  }
  function overrideInitConfigurationForBridge(initConfiguration) {
    return assign({}, initConfiguration, {
      applicationId: '00000000-aaaa-0000-aaaa-000000000000',
      sessionSampleRate: 100
    })
  }
}
