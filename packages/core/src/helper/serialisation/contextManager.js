import { computeBytesCount } from '../byteUtils'
import { deepClone, throttle } from '../tools'
import { jsonStringify } from './jsonStringify'
import { warnIfCustomerDataLimitReached } from './heavyCustomerDataWarning'

export var BYTES_COMPUTATION_THROTTLING_DELAY = 200

export function createContextManager(customerDataType, computeBytesCountImpl) {
  if (typeof computeBytesCountImpl === 'undefined') {
    computeBytesCountImpl = computeBytesCount
  }
  var context = {}
  var bytesCountCache
  var alreadyWarned = false

  // Throttle the bytes computation to minimize the impact on performance.
  // Especially useful if the user call context APIs synchronously multiple times in a row
  var computeBytesCountThrottled = throttle(function (context) {
    bytesCountCache = computeBytesCountImpl(jsonStringify(context))
    if (!alreadyWarned) {
      alreadyWarned = warnIfCustomerDataLimitReached(
        bytesCountCache,
        customerDataType
      )
    }
  }, BYTES_COMPUTATION_THROTTLING_DELAY).throttled

  return {
    getBytesCount: function () {
      return bytesCountCache
    },
    /** @deprecated use getContext instead */
    get: function () {
      return context
    },

    /** @deprecated use setContextProperty instead */
    add: function (key, value) {
      context[key] = value
      computeBytesCountThrottled(context)
    },

    /** @deprecated renamed to removeContextProperty */
    remove: function (key) {
      delete context[key]
      computeBytesCountThrottled(context)
    },

    /** @deprecated use setContext instead */
    set: function (newContext) {
      context = newContext
      computeBytesCountThrottled(context)
    },

    getContext: function () {
      return deepClone(context)
    },

    setContext: function (newContext) {
      context = deepClone(newContext)
      computeBytesCountThrottled(context)
    },

    setContextProperty: function (key, property) {
      context[key] = deepClone(property)
      computeBytesCountThrottled(context)
    },

    removeContextProperty: function (key) {
      delete context[key]
      computeBytesCountThrottled(context)
    },

    clearContext: function () {
      context = {}
      bytesCountCache = 0
    }
  }
}
