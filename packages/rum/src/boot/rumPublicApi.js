import {
  makePublicApi,
  checkCookiesAuthorized,
  checkIsNotLocalFile,
  BoundedBuffer,
  buildCookieOptions,
  createContextManager,
  isPercentage,
  clocksNow,
  extend2Lev,
  timeStampNow,
  ActionType,
  ErrorSource,
  isEmptyObject,
  deepClone,
  formatDate,
  createHandlingStack
} from '@cloudcare/browser-core'

export function makeRumPublicApi(startRumImpl) {
  var isAlreadyInitialized = false

  var globalContextManager = createContextManager()
  var user = {}

  var getInternalContextStrategy = function () {
    return undefined
  }
  var getDebugSessionStrategy = function () {
    return {}
  }
  var clearDebugSessionStrategy = function () {}
  var beforeInitAddSession = new BoundedBuffer()
  var addSessionStrategy = function (id) {
    beforeInitAddSession.add([id, timeStampNow()])
  }
  var beforeInitAddTiming = new BoundedBuffer()
  var addTimingStrategy = function (name) {
    beforeInitAddTiming.add([name, clocksNow()])
  }

  var beforeInitAddAction = new BoundedBuffer()
  var addActionStrategy = function (action) {
    beforeInitAddAction.add([action, clonedCommonContext()])
  }

  var beforeInitAddError = new BoundedBuffer()
  var addErrorStrategy = function (providedError) {
    beforeInitAddError.add([providedError, clonedCommonContext()])
  }

  function clonedCommonContext() {
    return deepClone(
      {
        context: globalContextManager.get(),
        user: user
      }
    )
  }

  var rumPublicApi = makePublicApi({
    init: function (userConfiguration) {
      if (
        !checkCookiesAuthorized(buildCookieOptions(userConfiguration)) ||
        !checkIsNotLocalFile() ||
        !canInitRum(userConfiguration)
      ) {
        return
      }
      // if (userConfiguration.publicApiKey) {
      //   userConfiguration.clientToken = userConfiguration.publicApiKey
      // }
      var _startRumImpl = startRumImpl(userConfiguration, function () {
        return {
          user: user,
          context: globalContextManager.get()
        }
      })
      addSessionStrategy = _startRumImpl.session.addDebugSession
      addActionStrategy = _startRumImpl.addAction
      addErrorStrategy = _startRumImpl.addError
      addTimingStrategy = _startRumImpl.addTiming

      getDebugSessionStrategy = _startRumImpl.session.getDebugSession
      clearDebugSessionStrategy = _startRumImpl.session.clearDebugSession

      getInternalContextStrategy = _startRumImpl.getInternalContext
      beforeInitAddSession.drain(function (data) {
        var id = data[0]
        var created_time = data[1]
        addSessionStrategy(id, created_time)
      })
      beforeInitAddAction.drain(function (data) {
        var action = data[0]
        var commonContext = data[1]
        addActionStrategy(action, commonContext)
      })
      beforeInitAddError.drain(function (data) {
        var error = data[0]
        var commonContext = data[1]
        addErrorStrategy(error, commonContext)
      })
      beforeInitAddTiming.drain(function (data) {
        var name = data[0]
        var endClocks = data[1]
        addTimingStrategy(name, endClocks)
      })

      isAlreadyInitialized = true
    },

    addRumGlobalContext: globalContextManager.add,

    removeRumGlobalContext: globalContextManager.remove,

    getRumGlobalContext: globalContextManager.get,
    setRumGlobalContext: globalContextManager.set,

    getInternalContext: function (startTime) {
      return getInternalContextStrategy(startTime)
    },
    addDebugSession: function (id) {
      addSessionStrategy(id)
      this.getDebugSession()
    },
    clearDebugSession: function () {
      clearDebugSessionStrategy()
      console.log('%c应用已关闭调试模式!!!', 'font-size: 18px;color:yellow')
    },
    getDebugSession: function () {
      var debugInfo = getDebugSessionStrategy()
      if (isEmptyObject(debugInfo)) {
        console.log(
          '%c应用未开启调试模式!!!可以调用%caddDebugSession%c开启',
          'font-size: 18px;color:yellow',
          'font-size: 18px;color:red;font-weight: bold',
          'font-size: 18px;color:yellow'
        )
        return debugInfo
      } else {
        const formatTime = formatDate(new Date(+debugInfo.created))
        const did = debugInfo.id
        console.log(
          '%c应用已开启调试模式!!!调试信息如下:',
          'font-size: 18px;color:yellow'
        )
        console.log(
          '%c调试模式session id: %c' + did,
          'font-size: 18px;color:yellow',
          'font-size: 18px;color:red;font-weight: bold'
        )
        console.log(
          '%c调试模式开始时间: %c' + formatTime,
          'font-size: 18px;color:yellow',
          'font-size: 18px;color:red;font-weight: bold'
        )
        console.log(
          '%c可以调用%cclearDebugSession%c关闭调试模式',
          'font-size: 18px;color:yellow',
          'font-size: 18px;color:red;font-weight: bold',
          'font-size: 18px;color:yellow'
        )
        return extend2Lev(debugInfo, {format_created: formatTime})
      }
      
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
      const handlingStack = createHandlingStack()
      addErrorStrategy({
        error: error,
        handlingStack:handlingStack,
        context: deepClone(context),
        startClocks: clocksNow(),
      })
      
    },

    // addTiming: function (name) {
    //   addTimingStrategy(name)
    // },

    setUser: function (newUser) {
      var sanitizedUser = sanitizeUser(newUser)
      if (sanitizedUser) {
        user = sanitizedUser
      } else {
        console.error('Unsupported user:', newUser)
      }
    },
    removeUser: function () {
      user = {}
    }
  })
  return rumPublicApi

  function sanitizeUser(newUser) {
    if (typeof newUser !== 'object' || !newUser) {
      return
    }
    var result = extend2Lev({}, newUser)
    if ('id' in result) {
      result.id = String(result.id)
    }
    if ('name' in result) {
      result.name = String(result.name)
    }
    if ('email' in result) {
      result.email = String(result.email)
    }
    return result
  }
  function canInitRum(userConfiguration) {
    if (isAlreadyInitialized) {
      console.error('DATAFLUX_RUM is already initialized.')
      return false
    }

    if (!userConfiguration.applicationId) {
      console.error(
        'Application ID is not configured, no RUM data will be collected.'
      )
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
    if (
      userConfiguration.resourceSampleRate !== undefined &&
      !isPercentage(userConfiguration.resourceSampleRate)
    ) {
      console.error('Resource Sample Rate should be a number between 0 and 100')
      return false
    }

    return true
  }
}
