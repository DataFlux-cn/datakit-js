import { computeBytesCount } from '../byteUtils'
import { DOM_EVENT } from '../enums'
import { map } from '../tools'
import { addEventListener } from '../../browser/addEventListener'
import { createContextManager } from './contextManager'
var CONTEXT_STORE_KEY_PREFIX = '_gc_s'

var storageListeners = []

export function createStoredContextManager(
  productKey,
  customerDataType,
  computeBytesCountImpl
) {
  if (computeBytesCountImpl === undefined) {
    computeBytesCountImpl = computeBytesCount
  }
  var storageKey = buildStorageKey(productKey, customerDataType)
  var contextManager = createContextManager(
    customerDataType,
    computeBytesCountImpl
  )

  synchronizeWithStorage()
  storageListeners.push(
    addEventListener(window, DOM_EVENT.STORAGE, function (params) {
      if (storageKey === params.key) {
        synchronizeWithStorage()
      }
    })
  )
  contextManager.changeObservable.subscribe(dumpToStorage)
  function synchronizeWithStorage() {
    var rawContext = localStorage.getItem(storageKey)
    var context = rawContext !== null ? JSON.parse(rawContext) : {}
    contextManager.setContext(context)
  }

  function dumpToStorage() {
    localStorage.setItem(
      storageKey,
      JSON.stringify(contextManager.getContext())
    )
  }
  return contextManager
}

export function buildStorageKey(productKey, customerDataType) {
  return CONTEXT_STORE_KEY_PREFIX + '_' + productKey + '_' + customerDataType
}

export function removeStorageListeners() {
  map(storageListeners, function (listener) {
    listener.stop()
  })
}
