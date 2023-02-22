import { timeStampNow } from '@cloudcare/browser-core'
import { getViewportDimension } from '../../initViewportObservable'

import { RecordType, IncrementalSource } from '../../../types'
import { serializeDocument, SerializationContextStatus } from './serialize'
import { initObservers } from './observers'

import { getVisualViewport, getScrollX, getScrollY } from './viewports'
import { assembleIncrementalSnapshot } from './utils'
import { createElementsScrollPositions } from './elementsScrollPositions'
import { initShadowRootsController } from './shadowRootsController'

export function record(options) {
  var emit = options.emit
  // runtime checks for user options
  if (!emit) {
    throw new Error('emit function is required')
  }

  var elementsScrollPositions = createElementsScrollPositions()
  var mutationCb = function (mutation) {
    return emit(
      assembleIncrementalSnapshot(IncrementalSource.Mutation, mutation)
    )
  }
  var inputCb = function (v) {
    return emit(assembleIncrementalSnapshot(IncrementalSource.Input, v))
  }
  var shadowRootsController = initShadowRootsController(options.configuration, {
    mutationCb: mutationCb,
    inputCb: inputCb
  })
  var takeFullSnapshot = function (timestamp, serializationContext) {
    if (timestamp === undefined) {
      timestamp = timeStampNow()
    }
    if (serializationContext === undefined) {
      serializationContext = {
        status: SerializationContextStatus.INITIAL_FULL_SNAPSHOT,
        elementsScrollPositions: elementsScrollPositions,
        shadowRootsController: shadowRootsController
      }
    }
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

  var _initObservers = initObservers({
    lifeCycle: options.lifeCycle,
    configuration: options.configuration,
    elementsScrollPositions: elementsScrollPositions,
    inputCb: inputCb,
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

    mutationCb: mutationCb,
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
    },
    shadowRootsController: shadowRootsController
  })
  var stopObservers = _initObservers.stop
  var flushMutationsFromObservers = _initObservers.flush
  function flushMutations() {
    shadowRootsController.flush()
    flushMutationsFromObservers()
  }
  return {
    stop: function () {
      shadowRootsController.stop()
      stopObservers()
    },
    takeSubsequentFullSnapshot: function (timestamp) {
      flushMutations()
      return takeFullSnapshot(timestamp, {
        shadowRootsController: shadowRootsController,
        status: SerializationContextStatus.SUBSEQUENT_FULL_SNAPSHOT,
        elementsScrollPositions: elementsScrollPositions
      })
    },
    flushMutations: flushMutations,
    shadowRootsController: shadowRootsController
  }
}
