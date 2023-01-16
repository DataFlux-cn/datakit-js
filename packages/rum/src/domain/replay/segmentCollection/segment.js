import { assign } from '@cloudcare/browser-core'
import { RecordType } from '../../../types'
import * as replayStats from '../replayStats'

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
  this.id = nextId++
  replayStats.addSegment(viewId)
  replayStats.addRecord(viewId)
  var _this = this
  var listener = function (params) {
    var data = params.data
    if (data.type === 'errored' || data.type === 'initialized') {
      return
    }

    if (data.id === _this.id) {
      replayStats.addWroteData(viewId, data.additionalBytesCount)
      if (data.type === 'flushed') {
        onFlushed(data.result, data.rawBytesCount)
        worker.removeEventListener('message', listener)
      } else {
        onWrote(data.compressedBytesCount)
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
      worker.removeEventListener('message', listener)
    }
  }
  worker.addEventListener('message', listener)
  this.worker.postMessage({
    data: '{"records":[' + JSON.stringify(initialRecord),
    id: this.id,
    action: 'write'
  })
}
Segment.prototype.addRecord = function (record) {
  this.metadata.start = Math.min(this.metadata.start, record.timestamp)
  this.metadata.end = Math.max(this.metadata.end, record.timestamp)
  this.metadata.records_count += 1
  replayStats.addRecord(this.metadata.view.id)
  if (!this.metadata.has_full_snapshot) {
    this.metadata.has_full_snapshot = record.type === RecordType.FullSnapshot
  }
  this.worker.postMessage({
    data: ',' + JSON.stringify(record),
    id: this.id,
    action: 'write'
  })
}
Segment.prototype.flush = function (reason) {
  this.worker.postMessage({
    data: '],' + JSON.stringify(this.metadata).slice(1) + '\n',
    id: this.id,
    action: 'flush'
  })
  this.flushReason = reason
}
