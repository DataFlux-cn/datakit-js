import {
  ONE_SECOND,
  LifeCycleEventType,
  isPageExitReason,
  setTimeout,
  clearTimeout
} from '@cloudcare/browser-core'
import { buildReplayPayload } from './buildReplayPayload'
import { Segment } from './segment'

export var SEGMENT_DURATION_LIMIT = 30 * ONE_SECOND
/**
 * beacon payload max queue size implementation is 64kb
 * ensure that we leave room for logs, rum and potential other users
 */
export var SEGMENT_BYTES_LIMIT = 60000

// Segments are the main data structure for session replays. They contain context information used
// for indexing or UI needs, and a list of records (RRWeb 'events', renamed to avoid confusing
// namings). They are stored without any processing from the intake, and fetched one after the
// other while a session is being replayed. Their encoding (deflate) are carefully crafted to allow
// concatenating multiple segments together. Segments have a size overhead (metadata), so our goal is to
// build segments containing as many records as possible while complying with the various flush
// strategies to guarantee a good replay quality.
//
// When the recording starts, a segment is initially created.  The segment is flushed (finalized and
// sent) based on various events (non-exhaustive list):
//
// * the page visibility change or becomes to unload
// * the segment duration reaches a limit
// * the encoded segment bytes count reaches a limit
// * ...
//
// A segment cannot be created without its context.  If the RUM session ends and no session id is
// available when creating a new segment, records will be ignored, until the session is renewed and
// a new session id is available.
//
// Empty segments (segments with no record) aren't useful and should be ignored.
//
// To help investigate session replays issues, each segment is created with a "creation reason",
// indicating why the session has been created.

export function startSegmentCollection(
  lifeCycle,
  configuration,
  sessionManager,
  viewContexts,
  httpRequest,
  encoder
) {
  return doStartSegmentCollection(
    lifeCycle,
    function () {
      return computeSegmentContext(configuration, sessionManager, viewContexts)
    },
    httpRequest,
    encoder
  )
}

var SegmentCollectionStatus = {
  WaitingForInitialRecord: 0,
  SegmentPending: 1,
  Stopped: 2
}

export function doStartSegmentCollection(
  lifeCycle,
  getSegmentContext,
  httpRequest,
  encoder
) {
  var state = {
    status: SegmentCollectionStatus.WaitingForInitialRecord,
    nextSegmentCreationReason: 'init'
  }
  var subscribeViewCreated = lifeCycle.subscribe(
    LifeCycleEventType.VIEW_CREATED,
    function () {
      flushSegment('view_change')
    }
  )
  var unsubscribeViewCreated = subscribeViewCreated.unsubscribe
  var subscribePageExited = lifeCycle.subscribe(
    LifeCycleEventType.PAGE_EXITED,
    function (pageExitEvent) {
      flushSegment(pageExitEvent.reason)
    }
  )
  var unsubscribePageExited = subscribePageExited.unsubscribe

  function flushSegment(flushReason) {
    if (state.status === SegmentCollectionStatus.SegmentPending) {
      state.segment.flush(function (metadata) {
        var payload = buildReplayPayload(
          encoder.getEncodedBytes(),
          metadata,
          encoder.getRawBytesCount()
        )

        if (isPageExitReason(flushReason)) {
          httpRequest.sendOnExit(payload)
        } else {
          httpRequest.send(payload)
        }
      })
      clearTimeout(state.expirationTimeoutId)
    }

    if (flushReason !== 'stop') {
      state = {
        status: SegmentCollectionStatus.WaitingForInitialRecord,
        nextSegmentCreationReason: flushReason
      }
    } else {
      state = {
        status: SegmentCollectionStatus.Stopped
      }
    }
  }

  return {
    addRecord: function (record) {
      if (state.status === SegmentCollectionStatus.Stopped) {
        return
      }

      if (state.status === SegmentCollectionStatus.WaitingForInitialRecord) {
        var context = getSegmentContext()
        if (!context) {
          return
        }

        state = {
          status: SegmentCollectionStatus.SegmentPending,
          segment: new Segment(
            encoder,
            context,
            state.nextSegmentCreationReason
          ),
          expirationTimeoutId: setTimeout(function () {
            flushSegment('segment_duration_limit')
          }, SEGMENT_DURATION_LIMIT)
        }
      }

      var segment = state.segment

      segment.addRecord(record, function () {
        if (
          // the written segment is still pending
          state.status === SegmentCollectionStatus.SegmentPending &&
          state.segment === segment &&
          encoder.getEncodedBytesCount() > SEGMENT_BYTES_LIMIT
        ) {
          flushSegment('segment_bytes_limit')
        }
      })
    },

    stop: function () {
      flushSegment('stop')
      unsubscribeViewCreated()
      unsubscribePageExited()
    }
  }
}

export function computeSegmentContext(
  configuration,
  sessionManager,
  viewContexts
) {
  var session = sessionManager.findTrackedSession()
  var viewContext = viewContexts.findView()
  if (!session || !viewContext) {
    return undefined
  }
  return {
    sdk: {
      name: configuration.sdkName,
      version: configuration.sdkVersion
    },
    env: configuration.env || '',
    service: viewContext.service || configuration.service || 'browser',
    version: viewContext.version || configuration.version || '',
    app: {
      id: configuration.applicationId
    },
    session: {
      id: session.id
    },
    view: {
      id: viewContext.id
    }
  }
}

export function setSegmentBytesLimit(newSegmentBytesLimit = 60_000) {
  SEGMENT_BYTES_LIMIT = newSegmentBytesLimit
}
