import {
  display,
  includes,
  setTimeout,
  addEventListener,
  addTelemetryError,
  ONE_SECOND
} from '@cloudcare/browser-core'

export var INITIALIZATION_TIME_OUT_DELAY = 10 * ONE_SECOND

export function createDeflateWorker() {
  return new Worker(
    URL.createObjectURL(new Blob([__BUILD_ENV__WORKER_STRING__]))
  )
}
/**
 * In order to be sure that the worker is correctly working, we need a round trip of
 * initialization messages, making the creation asynchronous.
 * These worker lifecycle states handle this case.
 */
export var DeflateWorkerStatus = {
  Nil: 0,
  Loading: 1,
  Error: 2,
  Initialized: 3
}

var state = { status: DeflateWorkerStatus.Nil }

export function startDeflateWorker(
  onInitializationFailure,
  createDeflateWorkerImpl
) {
  if (createDeflateWorkerImpl === undefined) {
    createDeflateWorkerImpl = createDeflateWorker
  }
  if (state.status === DeflateWorkerStatus.Nil) {
    doStartDeflateWorker(createDeflateWorkerImpl)
  }
  switch (state.status) {
    case DeflateWorkerStatus.Loading:
      state.initializationFailureCallbacks.push(onInitializationFailure)
      return state.worker
    case DeflateWorkerStatus.Initialized:
      return state.worker
  }
}

export function resetDeflateWorkerState() {
  state = { status: DeflateWorkerStatus.Nil }
}
export function getDeflateWorkerStatus() {
  return state.status
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
        onInitialized(data.version)
      }
    })
    worker.postMessage({ action: 'init' })
    setTimeout(onTimeout, INITIALIZATION_TIME_OUT_DELAY)
    state = {
      status: DeflateWorkerStatus.Loading,
      worker: worker,
      initializationFailureCallbacks: []
    }
  } catch (error) {
    onError(error)
  }
}
function onTimeout() {
  if (state.status === DeflateWorkerStatus.Loading) {
    display.error(
      'Session Replay recording failed to start: a timeout occurred while initializing the Worker'
    )
    state.initializationFailureCallbacks.forEach(function (callback) {
      callback()
    })
    state = { status: DeflateWorkerStatus.Error }
  }
}
function onInitialized(version) {
  if (state.status === DeflateWorkerStatus.Loading) {
    state = {
      status: DeflateWorkerStatus.Initialized,
      worker: state.worker,
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
    } else {
      addTelemetryError(error)
    }
    if (state.status === DeflateWorkerStatus.Loading) {
      state.initializationFailureCallbacks.forEach(function (callback) {
        callback()
      })
    }
    state = { status: DeflateWorkerStatus.Error }
  } else {
    addTelemetryError(error, {
      worker_version:
        state.status === DeflateWorkerStatus.Initialized && state.version,
      stream_id: streamId
    })
  }
}
function isMessageCspRelated(message) {
  return (
    includes(message, 'Content Security Policy') ||
    // Related to `require-trusted-types-for` CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/require-trusted-types-for
    includes(message, "requires 'TrustedScriptURL'")
  )
}
