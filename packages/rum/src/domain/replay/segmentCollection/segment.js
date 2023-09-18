import { assign } from '@cloudcare/browser-core'
import { RecordType } from '../../../types'
import * as replayStats from '../replayStats'

export function Segment(encoder, context, creationReason) {
  this.encoder = encoder
  var viewId = context.view.id

  this.metadata = assign(
    {
      start: Infinity,
      end: -Infinity,
      creation_reason: creationReason,
      records_count: 0,
      has_full_snapshot: false,
      index_in_view: replayStats.getSegmentsCount(viewId),
      source: 'browser'
    },
    context
  )
  replayStats.addSegment(viewId)
}
Segment.prototype.addRecord = function (record, callback) {
  this.metadata.start = Math.min(this.metadata.start, record.timestamp)
  this.metadata.end = Math.max(this.metadata.end, record.timestamp)
  this.metadata.records_count += 1
  if (!this.metadata.has_full_snapshot) {
    this.metadata.has_full_snapshot = record.type === RecordType.FullSnapshot
  }
  replayStats.addRecord(this.metadata.view.id)
  const prefix = this.metadata.records_count === 1 ? '{"records":[' : ','
  this.encoder.write(prefix + JSON.stringify(record), callback)
}
Segment.prototype.flush = function (callback) {
  if (this.metadata.records_count === 0) {
    throw new Error('Empty segment flushed')
  }
  var _this = this
  this.encoder.write(
    '],' + JSON.stringify(this.metadata).slice(1) + '\n',
    function () {
      replayStats.addWroteData(
        _this.metadata.view.id,
        _this.encoder.getRawBytesCount()
      )
      callback(_this.metadata)
    }
  )
  this.encoder.reset()
}
