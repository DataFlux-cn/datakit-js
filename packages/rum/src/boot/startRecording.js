import {
  timeStampNow,
  createHttpRequest,
  LifeCycleEventType
} from '@cloudcare/browser-core'
import { record } from '../domain/record'
import {
  startSegmentCollection,
  SEGMENT_BYTES_LIMIT
} from '../domain/segmentCollection'
import { RecordType } from '../types'

export function startRecording(
  lifeCycle,
  configuration,
  sessionManager,
  viewContexts,
  worker,
  httpRequest
) {
  var reportError = function (error) {
    lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, { error: error })
  }

  var replayRequest =
    httpRequest ||
    createHttpRequest(
      configuration.sessionReplayEndPoint,
      SEGMENT_BYTES_LIMIT,
      reportError
    )

  var segmentCollection = startSegmentCollection(
    lifeCycle,
    configuration.applicationId,
    sessionManager,
    viewContexts,
    replayRequest,
    worker
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
