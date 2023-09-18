import {
  addEventListener,
  concatBuffers,
  addTelemetryDebug
} from '@cloudcare/browser-core'
export var DeflateEncoderStreamId = {
  REPLAY: 1
}
export function createDeflateEncoder(worker, streamId) {
  var rawBytesCount = 0
  var compressedData = []
  var compressedDataTrailer

  var nextWriteActionId = 0
  var pendingWriteActions = []

  var wokerListener = addEventListener(worker, 'message', function (params) {
    var data = params.data
    if (data.type !== 'wrote' || data.streamId !== streamId) {
      return
    }

    var nextPendingAction = pendingWriteActions.shift()
    if (nextPendingAction && nextPendingAction.id === data.id) {
      if (data.id === 0) {
        // Initial state
        rawBytesCount = data.additionalBytesCount
        compressedData = [data.result]
      } else {
        rawBytesCount += data.additionalBytesCount
        compressedData.push(data.result)
      }
      compressedDataTrailer = data.trailer
      nextPendingAction.callback()
    } else {
      removeMessageListener()
      addTelemetryDebug('Worker responses received out of order.')
    }
  })
  var removeMessageListener = wokerListener.stop
  return {
    getEncodedBytes: function () {
      if (!compressedData.length) {
        return new Uint8Array(0)
      }

      return concatBuffers(compressedData.concat(compressedDataTrailer))
    },

    getEncodedBytesCount: function () {
      if (!compressedData.length) {
        return 0
      }

      return (
        compressedData.reduce(function (total, buffer) {
          return total + buffer.length
        }, 0) + compressedDataTrailer.length
      )
    },

    getRawBytesCount: function () {
      return rawBytesCount
    },

    write: function (data, callback) {
      worker.postMessage({
        action: 'write',
        id: nextWriteActionId,
        data: data,
        streamId: streamId
      })
      pendingWriteActions.push({
        id: nextWriteActionId,
        callback: callback
      })
      nextWriteActionId += 1
    },

    reset: function () {
      worker.postMessage({
        action: 'reset',
        streamId: streamId
      })
      nextWriteActionId = 0
    }
  }
}
