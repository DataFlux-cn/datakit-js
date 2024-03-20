import { noop } from './tools'
import { setTimeout } from './timer'
import { callMonitored } from './monitor'
export function instrumentMethod(object, method, instrumentationFactory) {
  var original = object[method]

  var instrumentation = instrumentationFactory(original)

  var instrumentationWrapper = function () {
    if (typeof instrumentation !== 'function') {
      return undefined
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return instrumentation.apply(this, arguments)
  }
  object[method] = instrumentationWrapper
  return {
    stop: function () {
      if (object[method] === instrumentationWrapper) {
        object[method] = original
      } else {
        instrumentation = original
      }
    }
  }
}

export function instrumentMethodAndCallOriginal(object, method, aliasOption) {
  return instrumentMethod(object, method, function (original) {
    return function () {
      var result
      if (aliasOption && aliasOption.before) {
        callMonitored(aliasOption.before, this, arguments)
        // aliasOption.before.apply(this, arguments)
      }
      if (typeof original === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        result = original.apply(this, arguments)
      }
      if (aliasOption && aliasOption.after) {
        callMonitored(aliasOption.after, this, arguments)
        // aliasOption.after.apply(this, arguments)
      }
      return result
    }
  })
}

export function instrumentSetter(object, property, after) {
  var originalDescriptor = Object.getOwnPropertyDescriptor(object, property)
  if (
    !originalDescriptor ||
    !originalDescriptor.set ||
    !originalDescriptor.configurable
  ) {
    return { stop: noop }
  }
  var stoppedInstrumentation = noop
  var instrumentation = function (thisObject, value) {
    // put hooked setter into event loop to avoid of set latency
    setTimeout(function () {
      if (instrumentation !== stoppedInstrumentation) {
        after(thisObject, value)
      }
    }, 0)
  }

  var instrumentationWrapper = function (value) {
    originalDescriptor.set.call(this, value)
    instrumentation(this, value)
  }

  Object.defineProperty(object, property, {
    set: instrumentationWrapper
  })

  return {
    stop: function () {
      if (
        Object.getOwnPropertyDescriptor(object, property) &&
        Object.getOwnPropertyDescriptor(object, property).set ===
          instrumentationWrapper
      ) {
        Object.defineProperty(object, property, originalDescriptor)
      } else {
        instrumentation = stoppedInstrumentation
      }
    }
  }
}
