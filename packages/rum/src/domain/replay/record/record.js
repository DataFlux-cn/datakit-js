import { timeStampNow } from '@cloudcare/browser-core'
import { getViewportDimension } from '../../initViewportObservable'

import { RecordType, IncrementalSource } from '../../../types'
import { serializeDocument, SerializationContextStatus } from './serialize'
import { initObservers } from './observers'

import { MutationController } from './mutationObserver'
import { getVisualViewport, getScrollX, getScrollY } from './viewports'
import { assembleIncrementalSnapshot } from './utils'
import { createElementsScrollPositions } from './elementsScrollPositions'

export function record(options) {
  var emit = options.emit
  // runtime checks for user options
  if (!emit) {
    throw new Error('emit function is required')
  }

  var mutationController = new MutationController()
  var elementsScrollPositions = createElementsScrollPositions()

  var takeFullSnapshot = function (timestamp, serializationContext) {
    if (timestamp === undefined) {
      timestamp = timeStampNow()
    }
    if (serializationContext === undefined) {
      serializationContext = {
        status: SerializationContextStatus.INITIAL_FULL_SNAPSHOT,
        elementsScrollPositions: elementsScrollPositions
      }
    }
    mutationController.flush() // process any pending mutation before taking a full snapshot
    var viewportDimension = getViewportDimension()
    var width = viewportDimension.width
    var height = viewportDimension.height
    emit({
      data: {
        height: height,
        href: window.location.href,
        width: width
      },
      type: RecordType.Meta,
      timestamp: timestamp
    })

    emit({
      data: {
        has_focus: document.hasFocus()
      },
      type: RecordType.Focus,
      timestamp: timestamp
    })

    emit({
      data: {
        node: serializeDocument(
          document,
          options.configuration,
          serializationContext
        ),
        initialOffset: {
          left: getScrollX(),
          top: getScrollY()
        }
      },
      type: RecordType.FullSnapshot,
      timestamp: timestamp
    })

    if (window.visualViewport) {
      emit({
        data: getVisualViewport(),
        type: RecordType.VisualViewport,
        timestamp: timestamp
      })
    }
  }

  takeFullSnapshot()

  var stopObservers = initObservers({
    lifeCycle: options.lifeCycle,
    configuration: options.configuration,
    mutationController: mutationController,
    elementsScrollPositions: elementsScrollPositions,
    inputCb: function (v) {
      return emit(assembleIncrementalSnapshot(IncrementalSource.Input, v))
    },
    mediaInteractionCb: function (p) {
      return emit(
        assembleIncrementalSnapshot(IncrementalSource.MediaInteraction, p)
      )
    },
    mouseInteractionCb: function (mouseInteractionRecord) {
      return emit(mouseInteractionRecord)
    },
    mousemoveCb: function (positions, source) {
      return emit(assembleIncrementalSnapshot(source, { positions: positions }))
    },
    mutationCb: function (m) {
      return emit(assembleIncrementalSnapshot(IncrementalSource.Mutation, m))
    },
    scrollCb: function (p) {
      return emit(assembleIncrementalSnapshot(IncrementalSource.Scroll, p))
    },
    styleSheetCb: function (r) {
      return emit(
        assembleIncrementalSnapshot(IncrementalSource.StyleSheetRule, r)
      )
    },
    viewportResizeCb: function (d) {
      return emit(
        assembleIncrementalSnapshot(IncrementalSource.ViewportResize, d)
      )
    },
    frustrationCb: function (frustrationRecord) {
      return emit(frustrationRecord)
    },
    focusCb: function (data) {
      return emit({
        data: data,
        type: RecordType.Focus,
        timestamp: timeStampNow()
      })
    },
    visualViewportResizeCb: function (data) {
      return emit({
        data: data,
        type: RecordType.VisualViewport,
        timestamp: timeStampNow()
      })
    }
  })
  return {
    stop: stopObservers,
    takeSubsequentFullSnapshot: function (timestamp) {
      return takeFullSnapshot(timestamp, {
        status: SerializationContextStatus.SUBSEQUENT_FULL_SNAPSHOT,
        elementsScrollPositions: elementsScrollPositions
      })
    },
    flushMutations: function () {
      return mutationController.flush()
    }
  }
}
