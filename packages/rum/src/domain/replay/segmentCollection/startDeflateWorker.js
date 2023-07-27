import {
  display,
  includes,
  each,
  addEventListener
} from '@cloudcare/browser-core'
import { workerString } from '@cloudcare/browser-worker/string'
var workerURL

export function createDeflateWorker() {
  // Lazily compute the worker URL to allow importing the SDK in NodeJS
  if (!workerURL) {
    workerURL = URL.createObjectURL(new Blob([workerString]))
  }
  return new Worker(workerURL)
}
/**
 * In order to be sure that the worker is correctly working, we need a round trip of
 * initialization messages, making the creation asynchronous.
 * These worker lifecycle states handle this case.
 */
var DeflateWorkerStatus = {
  Nil: 0,
  Loading: 1,
  Error: 2,
  Initialized: 3
}

var state = { status: DeflateWorkerStatus.Nil }

export function startDeflateWorker(callback, createDeflateWorkerImpl) {
  if (createDeflateWorkerImpl === undefined) {
    createDeflateWorkerImpl = createDeflateWorker
  }
  switch (state.status) {
    case DeflateWorkerStatus.Nil:
      state = { status: DeflateWorkerStatus.Loading, callbacks: [callback] }
      doStartDeflateWorker(createDeflateWorkerImpl)
      break
    case DeflateWorkerStatus.Loading:
      state.callbacks.push(callback)
      break
    case DeflateWorkerStatus.Error:
      callback()
      break
    case DeflateWorkerStatus.Initialized:
      callback(state.worker)
      break
  }
}

export function resetDeflateWorkerState() {
  state = { status: DeflateWorkerStatus.Nil }
}

/**
 * Starts the deflate worker and handle messages and errors
 *
 * The spec allow browsers to handle worker errors differently:
 * - Chromium throws an exception
 * - Firefox fires an error event
 *
 * more details: https://bugzilla.mozilla.org/show_bug.cgi?id=1736865#c2
 */
export function doStartDeflateWorker(createDeflateWorkerImpl) {
  if (createDeflateWorkerImpl === undefined) {
    createDeflateWorkerImpl = createDeflateWorker
  }
  try {
    var worker = createDeflateWorkerImpl()
    addEventListener(worker, 'error', onError)
    addEventListener(worker, 'message', function (event) {
      var data = event.data
      if (data.type === 'errored') {
        onError(data.error, data.streamId)
      } else if (data.type === 'initialized') {
        onInitialized(worker, data.version)
      }
    })
    worker.postMessage({ action: 'init' })
    return worker
  } catch (error) {
    onError(error)
  }
}

function onInitialized(worker, version) {
  if (state.status === DeflateWorkerStatus.Loading) {
    each(state.callbacks, function (callback) {
      callback(worker)
    })
    state = {
      status: DeflateWorkerStatus.Initialized,
      worker: worker,
      version: version
    }
  }
}

function onError(error, streamId) {
  if (state.status === DeflateWorkerStatus.Loading) {
    display.error(
      'Session Replay recording failed to start: an error occurred while creating the Worker:',
      error
    )
    if (
      error instanceof Event ||
      (error instanceof Error && isMessageCspRelated(error.message))
    ) {
      display.error('Please make sure CSP is correctly configured !!!')
    }
    each(state.callbacks, function (callback) {
      callback()
    })
    state = { status: DeflateWorkerStatus.Error }
  }
}
function isMessageCspRelated(message) {
  return (
    includes(message, 'Content Security Policy') ||
    // Related to `require-trusted-types-for` CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/require-trusted-types-for
    includes(message, "requires 'TrustedScriptURL'")
  )
}
