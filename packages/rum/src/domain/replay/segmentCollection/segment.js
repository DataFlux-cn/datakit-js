import {
  assign,
  addEventListener,
  concatBuffers
} from '@cloudcare/browser-core'
import { RecordType } from '../../../types'
import * as replayStats from '../replayStats'
var STREAM_ID = 1
var nextId = 0
export function Segment(
  worker,
  context,
  creationReason,
  initialRecord,
  onWrote,
  onFlushed
) {
  this.worker = worker
  this.pendingWriteCount = 0
  this.id = nextId++
  var viewId = context.view.id

  this.metadata = assign(
    {
      start: initialRecord.timestamp,
      end: initialRecord.timestamp,
      creation_reason: creationReason,
      records_count: 1,
      has_full_snapshot: initialRecord.type === RecordType.FullSnapshot,
      index_in_view: replayStats.getSegmentsCount(viewId),
      source: 'browser'
    },
    context
  )
  replayStats.addSegment(viewId)
  replayStats.addRecord(viewId)
  var rawBytesCount = 0
  var compressedBytesCount = 0
  var compressedData = []
  var _this = this
  var wokerListener = addEventListener(worker, 'message', listener)
  var removeMessageListener = wokerListener.stop
  var listener = function (params) {
    var data = params.data
    if (data.type !== 'wrote') {
      return
    }
    // if (data.type === 'errored' || data.type === 'initialized') {
    //   return
    // }
    if (data.id === _this.id) {
      _this.pendingWriteCount -= 1
      replayStats.addWroteData(viewId, data.additionalBytesCount)
      rawBytesCount += data.additionalBytesCount
      compressedBytesCount += data.result.length
      compressedData.push(data.result)
      if (_this.flushReason && _this.pendingWriteCount === 0) {
        compressedData.push(data.trailer)
        onFlushed(concatBuffers(compressedData), rawBytesCount)
        removeMessageListener()
      } else {
        onWrote(compressedBytesCount)
      }
    } else if (data.id > _this.id) {
      // Messages should be received in the same order as they are sent, so if we receive a
      // message with an id superior to this Segment instance id, we know that another, more
      // recent Segment instance is being used.
      //
      // In theory, a "flush" response should have been received at this point, so the listener
      // should already have been removed. But if something goes wrong and we didn't receive a
      // "flush" response, remove the listener to avoid any leak, and send a monitor message to
      // help investigate the issue.
      removeMessageListener()
    }
  }
  //   worker.addEventListener('message', listener)

  this.write('{"records":[' + JSON.stringify(initialRecord))
}
Segment.prototype.addRecord = function (record) {
  this.metadata.start = Math.min(this.metadata.start, record.timestamp)
  this.metadata.end = Math.max(this.metadata.end, record.timestamp)
  this.metadata.records_count += 1
  replayStats.addRecord(this.metadata.view.id)
  if (!this.metadata.has_full_snapshot) {
    this.metadata.has_full_snapshot = record.type === RecordType.FullSnapshot
  }
  this.write(',' + JSON.stringify(record))
}
Segment.prototype.flush = function (reason) {
  this.write('],' + JSON.stringify(this.metadata).slice(1) + '\n')

  this.worker.postMessage({
    action: 'reset',
    streamId: STREAM_ID
  })
  this.flushReason = reason
}

Segment.prototype.write = function (data) {
  this.pendingWriteCount += 1
  this.worker.postMessage({
    data: data,
    id: this.id,
    streamId: STREAM_ID,
    action: 'write'
  })
}
