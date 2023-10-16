import {
  timeStampNow,
  createHttpRequest,
  LifeCycleEventType,
  addTelemetryDebug
} from '@cloudcare/browser-core'
import { record } from '../domain/replay/record'
import {
  startSegmentCollection,
  SEGMENT_BYTES_LIMIT
} from '../domain/replay/segmentCollection'
import { RecordType } from '../types'

export function startRecording(
  lifeCycle,
  configuration,
  sessionManager,
  viewContexts,
  encoder,
  httpRequest
) {
  var reportError = function (error) {
    lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, { error: error })
    addTelemetryDebug('Error reported to customer', {
      'error.message': error.message
    })
  }

  var replayRequest =
    httpRequest ||
    createHttpRequest(
      configuration.sessionReplayEndPoint,
      SEGMENT_BYTES_LIMIT,
      false,
      reportError
    )

  var segmentCollection = startSegmentCollection(
    lifeCycle,
    configuration,
    sessionManager,
    viewContexts,
    replayRequest,
    encoder
  )
  var addRecord = segmentCollection.addRecord
  var stopSegmentCollection = segmentCollection.stop

  var _record = record({
    emit: addRecord,
    configuration: configuration,
    lifeCycle: lifeCycle
  })
  var stopRecording = _record.stop
  var takeSubsequentFullSnapshot = _record.takeSubsequentFullSnapshot
  var flushMutations = _record.flushMutations
  var subscribeViewEnded = lifeCycle.subscribe(
    LifeCycleEventType.VIEW_ENDED,
    function () {
      flushMutations()
      addRecord({
        timestamp: timeStampNow(),
        type: RecordType.ViewEnd
      })
    }
  )
  var scribeViewCreated = lifeCycle.subscribe(
    LifeCycleEventType.VIEW_CREATED,
    function (view) {
      takeSubsequentFullSnapshot(view.startClocks.timeStamp)
    }
  )

  return {
    stop: function () {
      subscribeViewEnded.unsubscribe()
      scribeViewCreated.unsubscribe()
      stopRecording()
      stopSegmentCollection()
    }
  }
}
