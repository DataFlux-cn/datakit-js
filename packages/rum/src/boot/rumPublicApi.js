import {
  makePublicApi,
  assign,
  areCookiesAuthorized,
  BoundedBuffer,
  display,
  buildCookieOptions,
  createContextManager,
  clocksNow,
  extend2Lev,
  timeStampNow,
  ActionType,
  isEmptyObject,
  deepClone,
  formatDate,
  createHandlingStack
} from '@cloudcare/browser-core'
import {validateAndBuildRumConfiguration} from '../domain/configuration'
export function makeRumPublicApi(startRumImpl) {
  var isAlreadyInitialized = false

  var globalContextManager = createContextManager()
  var userContextManager = createContextManager()
  var bufferApiCalls = new BoundedBuffer()
  var addTimingStrategy = function(name, time){
    if (typeof time === 'undefined') {
      time = timeStampNow()
    }
    bufferApiCalls.add(function() {
      return addTimingStrategy(name, time)
    })
  }
  var startViewStrategy = function(options, startClocks){
    if (typeof startClocks === 'undefined') {
      startClocks = clocksNow()
    }
    bufferApiCalls.add(function() {
      return startViewStrategy(options, startClocks)
    })
  }
  var addActionStrategy = function(
    action,
    commonContext
  ) {
    if (typeof commonContext == 'undefined') {
      commonContext = {
        context: globalContextManager.getContext(),
        user: userContextManager.getContext(),
      }
    }
    bufferApiCalls.add(function() {
      return addActionStrategy(action, commonContext)
    })
  }
  var addErrorStrategy = function(
    providedError,
    commonContext
  )  {
    if (typeof commonContext == 'undefined') {
      commonContext = {
        context: globalContextManager.getContext(),
        user: userContextManager.getContext(),
      }
    }
    bufferApiCalls.add(function() {
      return addErrorStrategy(providedError, commonContext)
    })
  }


  var getInternalContextStrategy = function () {
    return undefined
  }
  var getInitConfigurationStrategy = function() {
    return undefined
  }

  
  function initRum(initConfiguration) {
   
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

      startViewStrategy = function(options){
        doStartRum(configuration, options)
      }
      beforeInitCalls.drain()
    }
    getInitConfigurationStrategy = function() {
      return deepClone(initConfiguration)
    }

    isAlreadyInitialized = true
  }
  function doStartRum(configuration, initialViewOptions) {
    var startRumResults = startRumImpl(
      configuration,
      function() {
        return {
          user: userContextManager.getContext(),
          context: globalContextManager.getContext(),
        }
      },
      initialViewOptions
    )
    startViewStrategy = startRumResults.startView
    addActionStrategy = startRumResults.addAction
    addErrorStrategy = startRumResults.addError
    addTimingStrategy = startRumResults.addTiming
    getInternalContextStrategy = startRumResults.getInternalContext 
    bufferApiCalls.drain()
  }
  var startView = function(options) {
    var sanitizedOptions = typeof options === 'object' ? options : { name: options }
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

    getInitConfiguration: function() {
      return getInitConfigurationStrategy()
    },
    getInternalContext: function (startTime) {
      return getInternalContextStrategy(startTime)
    },
    addDebugSession: function (id) {
    },
    clearDebugSession: function () {
    },
    getDebugSession: function () {
    },
    addAction: function (name, context) {
      addActionStrategy({
        name: name,
        context: deepClone(context),
        startClocks: clocksNow(),
        type: ActionType.CUSTOM,
      })
    },

    /**
     * @deprecated use addAction instead
     */
    // addUserAction: function (name, context) {
    //   rumPublicApi.addAction(name, context)
    // },

    addError: function (error, context) {
      var handlingStack = createHandlingStack()
      addErrorStrategy({
        error: error,
        handlingStack:handlingStack,
        context: deepClone(context),
        startClocks: clocksNow(),
      })
    },
    addTiming: function(name, time){
      addTimingStrategy(name, time)
    },
    setUser: function (newUser) {
      if (typeof newUser !== 'object' || !newUser) {
        display.error('Unsupported user:', newUser)
      } else {
        userContextManager.setContext(sanitizeUser(newUser))
      }
    },
    getUser: userContextManager.getContext,
    setUserProperty: function(key, property){
      var newUser = {}
      newUser[key] = property
      var sanitizedProperty = sanitizeUser(newUser)[key]
      userContextManager.setContextProperty(key, sanitizedProperty)
    },
    removeUserProperty: userContextManager.removeContextProperty,

    /** @deprecated: renamed to clearUser */
    removeUser: userContextManager.clearContext,
    clearUser: userContextManager.clearContext,
    startView: startView
  })
  return rumPublicApi

  function sanitizeUser(newUser) {
    var shallowClonedUser = assign(newUser, {})
    if ('id' in shallowClonedUser) {
      shallowClonedUser.id = String(shallowClonedUser.id)
    }
    if ('name' in shallowClonedUser) {
      shallowClonedUser.name = String(shallowClonedUser.name)
    }
    if ('email' in shallowClonedUser) {
      shallowClonedUser.email = String(shallowClonedUser.email)
    }
    return shallowClonedUser
  }
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
}

