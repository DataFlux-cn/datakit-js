import {
  instrumentSetter,
  instrumentMethodAndCallOriginal,
  throttle,
  DOM_EVENT,
  addEventListeners,
  addEventListener,
  noop,
  LifeCycleEventType,
  RumEventType,
  ActionType,
  keys,
  map,
  each,
  assign,
  isNodeShadowHost
} from '@cloudcare/browser-core'
import { initViewportObservable } from '../../initViewportObservable'
import { NodePrivacyLevel } from '../../../constants'
import {
  RecordType,
  IncrementalSource,
  MediaInteractionType,
  MouseInteractionType
} from '../../../types'
import { getNodePrivacyLevel, shouldMaskNode } from './privacy'
import {
  getElementInputValue,
  getSerializedNodeId,
  hasSerializedNode
} from './serializationUtils'
import {
  assembleIncrementalSnapshot,
  forEach,
  getPathToNestedCSSRule,
  isTouchEvent
} from './utils'
import { startMutationObserver } from './mutationObserver'
import {
  getVisualViewport,
  getScrollX,
  getScrollY,
  convertMouseEventToLayoutCoordinates
} from './viewports'

var MOUSE_MOVE_OBSERVER_THRESHOLD = 50
var SCROLL_OBSERVER_THRESHOLD = 100
var VISUAL_VIEWPORT_OBSERVER_THRESHOLD = 200

var recordIds = new WeakMap()
var nextId = 1

function getRecordIdForEvent(event) {
  if (!recordIds.has(event)) {
    recordIds.set(event, nextId++)
  }
  return recordIds.get(event)
}

export function initObservers(o) {
  var mutationHandler = initMutationObserver(
    o.mutationCb,
    o.configuration,
    o.shadowRootsController
  )
  var mousemoveHandler = initMoveObserver(o.mousemoveCb)
  var mouseInteractionHandler = initMouseInteractionObserver(
    o.mouseInteractionCb,
    o.configuration.defaultPrivacyLevel
  )
  var scrollHandler = initScrollObserver(
    o.scrollCb,
    o.configuration.defaultPrivacyLevel,
    o.elementsScrollPositions
  )
  var viewportResizeHandler = initViewportResizeObserver(o.viewportResizeCb)
  var inputHandler = initInputObserver(
    o.inputCb,
    o.configuration.defaultPrivacyLevel
  )
  var mediaInteractionHandler = initMediaInteractionObserver(
    o.mediaInteractionCb,
    o.configuration.defaultPrivacyLevel
  )
  var styleSheetObserver = initStyleSheetObserver(o.styleSheetCb)
  var focusHandler = initFocusObserver(o.focusCb)
  var visualViewportResizeHandler = initVisualViewportResizeObserver(
    o.visualViewportResizeCb
  )
  var frustrationHandler = initFrustrationObserver(o.lifeCycle, o.frustrationCb)

  return {
    flush: function () {
      mutationHandler.flush()
    },
    stop: function () {
      mutationHandler.stop()
      mousemoveHandler()
      mouseInteractionHandler()
      scrollHandler()
      viewportResizeHandler()
      inputHandler()
      mediaInteractionHandler()
      styleSheetObserver()
      focusHandler()
      visualViewportResizeHandler()
      frustrationHandler()
    }
  }
}

function initMutationObserver(cb, configuration, shadowRootsController) {
  return startMutationObserver(
    cb,
    configuration,
    shadowRootsController,
    document
  )
}

function initMoveObserver(cb) {
  var _updatePosition = throttle(
    function (event) {
      var target = getEventTarget(event)
      if (hasSerializedNode(target)) {
        var coordinates = tryToComputeCoordinates(event)
        if (!coordinates) {
          return
        }
        var position = {
          id: getSerializedNodeId(target),
          timeOffset: 0,
          x: coordinates.x,
          y: coordinates.y
        }
        cb(
          [position],
          isTouchEvent(event)
            ? IncrementalSource.TouchMove
            : IncrementalSource.MouseMove
        )
      }
    },
    MOUSE_MOVE_OBSERVER_THRESHOLD,
    {
      trailing: false
    }
  )
  var updatePosition = _updatePosition.throttled
  return addEventListeners(
    document,
    [DOM_EVENT.MOUSE_MOVE, DOM_EVENT.TOUCH_MOVE],
    updatePosition,
    {
      capture: true,
      passive: true
    }
  ).stop
}

var eventTypeToMouseInteraction = {
  [DOM_EVENT.POINTER_UP]: MouseInteractionType.MouseUp,
  [DOM_EVENT.MOUSE_DOWN]: MouseInteractionType.MouseDown,
  [DOM_EVENT.CLICK]: MouseInteractionType.Click,
  [DOM_EVENT.CONTEXT_MENU]: MouseInteractionType.ContextMenu,
  [DOM_EVENT.DBL_CLICK]: MouseInteractionType.DblClick,
  [DOM_EVENT.FOCUS]: MouseInteractionType.Focus,
  [DOM_EVENT.BLUR]: MouseInteractionType.Blur,
  [DOM_EVENT.TOUCH_START]: MouseInteractionType.TouchStart,
  [DOM_EVENT.TOUCH_END]: MouseInteractionType.TouchEnd
}
function initMouseInteractionObserver(cb, defaultPrivacyLevel) {
  var handler = function (event) {
    var target = getEventTarget(event)
    if (
      getNodePrivacyLevel(target, defaultPrivacyLevel) ===
        NodePrivacyLevel.HIDDEN ||
      !hasSerializedNode(target)
    ) {
      return
    }
    var id = getSerializedNodeId(target)
    var type = eventTypeToMouseInteraction[event.type]
    var interaction
    if (
      type !== MouseInteractionType.Blur &&
      type !== MouseInteractionType.Focus
    ) {
      var coordinates = tryToComputeCoordinates(event)
      if (!coordinates) {
        return
      }
      interaction = { id: id, type: type, x: coordinates.x, y: coordinates.y }
    } else {
      interaction = { id: id, type: type }
    }

    var record = assign(
      { id: getRecordIdForEvent(event) },
      assembleIncrementalSnapshot(
        IncrementalSource.MouseInteraction,
        interaction
      )
    )
    cb(record)
  }
  return addEventListeners(
    document,
    keys(eventTypeToMouseInteraction),
    handler,
    {
      capture: true,
      passive: true
    }
  ).stop
}
function tryToComputeCoordinates(event) {
  var commonEvent = isTouchEvent(event) ? event.changedTouches[0] : event
  var x = commonEvent.clientX
  var y = commonEvent.clientY
  if (window.visualViewport) {
    var mouseEventCoordinates = convertMouseEventToLayoutCoordinates(x, y)
    var visualViewportX = mouseEventCoordinates.visualViewportX
    var visualViewportY = mouseEventCoordinates.visualViewportY
    x = visualViewportX
    y = visualViewportY
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined
  }
  return { x: x, y: y }
}
function initScrollObserver(cb, defaultPrivacyLevel, elementsScrollPositions) {
  var _updatePosition = throttle(function (event) {
    var target = getEventTarget(event)
    if (
      !target ||
      getNodePrivacyLevel(target, defaultPrivacyLevel) ===
        NodePrivacyLevel.HIDDEN ||
      !hasSerializedNode(target)
    ) {
      return
    }
    var id = getSerializedNodeId(target)
    var scrollPositions =
      target === document
        ? {
            scrollTop: getScrollY(),
            scrollLeft: getScrollX()
          }
        : {
            scrollTop: Math.round(target.scrollTop),
            scrollLeft: Math.round(target.scrollLeft)
          }
    elementsScrollPositions.set(target, scrollPositions)
    cb({
      id: id,
      x: scrollPositions.scrollLeft,
      y: scrollPositions.scrollTop
    })
  }, SCROLL_OBSERVER_THRESHOLD)
  var updatePosition = _updatePosition.throttled
  return addEventListener(document, DOM_EVENT.SCROLL, updatePosition, {
    capture: true,
    passive: true
  }).stop
}

function initViewportResizeObserver(cb) {
  return initViewportObservable().subscribe(cb).unsubscribe
}

export function initInputObserver(
  cb,
  defaultPrivacyLevel,
  inputObserverOptions
) {
  var domEvents = (inputObserverOptions && inputObserverOptions.domEvents) || [
    DOM_EVENT.INPUT,
    DOM_EVENT.CHANGE
  ]

  var target = (inputObserverOptions && inputObserverOptions.target) || document

  var lastInputStateMap = new WeakMap()

  function onElementChange(target) {
    var nodePrivacyLevel = getNodePrivacyLevel(target, defaultPrivacyLevel)
    if (nodePrivacyLevel === NodePrivacyLevel.HIDDEN) {
      return
    }

    var type = target.type

    var inputState
    if (type === 'radio' || type === 'checkbox') {
      if (shouldMaskNode(target, nodePrivacyLevel)) {
        return
      }
      inputState = { isChecked: target.checked }
    } else {
      var value = getElementInputValue(target, nodePrivacyLevel)
      if (value === undefined) {
        return
      }
      inputState = { text: value }
    }

    // Can be multiple changes on the same node within the same batched mutation observation.
    cbWithDedup(target, inputState)

    // If a radio was checked, other radios with the same name attribute will be unchecked.
    var name = target.name
    if (type === 'radio' && name && target.checked) {
      forEach(
        document.querySelectorAll(`input[type="radio"][name="${name}"]`),
        function (el) {
          if (el !== target) {
            // TODO: Consider the privacy implications for various differing input privacy levels
            cbWithDedup(el, { isChecked: false })
          }
        }
      )
    }
  }

  /**
   * There can be multiple changes on the same node within the same batched mutation observation.
   */
  function cbWithDedup(target, inputState) {
    if (!hasSerializedNode(target)) {
      return
    }
    var lastInputState = lastInputStateMap.get(target)
    if (
      !lastInputState ||
      lastInputState.text !== inputState.text ||
      lastInputState.isChecked !== inputState.isChecked
    ) {
      lastInputStateMap.set(target, inputState)
      cb(
        assign(
          {
            id: getSerializedNodeId(target)
          },
          inputState
        )
      )
    }
  }
  var _addEventListeners = addEventListeners(
    target,
    domEvents,
    function (event) {
      var target = getEventTarget(event)
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        onElementChange(target)
      }
    },
    {
      capture: true,
      passive: true
    }
  )

  var stopEventListeners = _addEventListeners.stop
  var instrumentationStoppers = [
    instrumentSetter(HTMLInputElement.prototype, 'value', onElementChange),
    instrumentSetter(HTMLInputElement.prototype, 'checked', onElementChange),
    instrumentSetter(HTMLSelectElement.prototype, 'value', onElementChange),
    instrumentSetter(HTMLTextAreaElement.prototype, 'value', onElementChange),
    instrumentSetter(
      HTMLSelectElement.prototype,
      'selectedIndex',
      onElementChange
    )
  ]

  return function () {
    each(instrumentationStoppers, function (stopper) {
      stopper.stop()
    })
    stopEventListeners()
  }
}

export function initStyleSheetObserver(cb) {
  function checkStyleSheetAndCallback(styleSheet, callback) {
    if (styleSheet && hasSerializedNode(styleSheet.ownerNode)) {
      callback(getSerializedNodeId(styleSheet.ownerNode))
    }
  }

  var instrumentationStoppers = [
    instrumentMethodAndCallOriginal(CSSStyleSheet.prototype, 'insertRule', {
      before: function (rule, index) {
        checkStyleSheetAndCallback(this, function (id) {
          return cb({ id: id, adds: [{ rule: rule, index: index }] })
        })
      }
    }),
    instrumentMethodAndCallOriginal(CSSStyleSheet.prototype, 'deleteRule', {
      before: function (index) {
        checkStyleSheetAndCallback(this, function (id) {
          return cb({ id: id, removes: [{ index: index }] })
        })
      }
    })
  ]

  if (typeof CSSGroupingRule !== 'undefined') {
    instrumentGroupingCSSRuleClass(CSSGroupingRule)
  } else {
    instrumentGroupingCSSRuleClass(CSSMediaRule)
    instrumentGroupingCSSRuleClass(CSSSupportsRule)
  }

  function instrumentGroupingCSSRuleClass(cls) {
    instrumentationStoppers.push(
      instrumentMethodAndCallOriginal(cls.prototype, 'insertRule', {
        before: function (rule, index) {
          var _this = this
          checkStyleSheetAndCallback(_this.parentStyleSheet, function (id) {
            var path = getPathToNestedCSSRule(_this)
            if (path) {
              path.push(index || 0)
              cb({ id: id, adds: [{ rule: rule, index: path }] })
            }
          })
        }
      }),
      instrumentMethodAndCallOriginal(cls.prototype, 'deleteRule', {
        before: function (index) {
          var _this = this
          checkStyleSheetAndCallback(_this.parentStyleSheet, function (id) {
            var path = getPathToNestedCSSRule(_this)
            if (path) {
              path.push(index)
              cb({ id: id, removes: [{ index: path }] })
            }
          })
        }
      })
    )
  }
  return function () {
    each(instrumentationStoppers, function (stopper) {
      stopper.stop()
    })
  }
}

function initMediaInteractionObserver(mediaInteractionCb, defaultPrivacyLevel) {
  var handler = function (event) {
    var target = getEventTarget(event)
    if (
      !target ||
      getNodePrivacyLevel(target, defaultPrivacyLevel) ===
        NodePrivacyLevel.HIDDEN ||
      !hasSerializedNode(target)
    ) {
      return
    }
    mediaInteractionCb({
      id: getSerializedNodeId(target),
      type:
        event.type === DOM_EVENT.PLAY
          ? MediaInteractionType.Play
          : MediaInteractionType.Pause
    })
  }
  return addEventListeners(
    document,
    [DOM_EVENT.PLAY, DOM_EVENT.PAUSE],
    handler,
    { capture: true, passive: true }
  ).stop
}

function initFocusObserver(focusCb) {
  return addEventListeners(
    window,
    [DOM_EVENT.FOCUS, DOM_EVENT.BLUR],
    function () {
      focusCb({ has_focus: document.hasFocus() })
    }
  ).stop
}

function initVisualViewportResizeObserver(cb) {
  if (!window.visualViewport) {
    return noop
  }
  var _updateDimension = throttle(
    function () {
      cb(getVisualViewport())
    },
    VISUAL_VIEWPORT_OBSERVER_THRESHOLD,
    {
      trailing: false
    }
  )
  var cancelThrottle = _updateDimension.cancel
  var updateDimension = _updateDimension.throttled
  var removeListener = addEventListeners(
    window.visualViewport,
    [DOM_EVENT.RESIZE, DOM_EVENT.SCROLL],
    updateDimension,
    {
      capture: true,
      passive: true
    }
  ).stop

  return function stop() {
    removeListener()
    cancelThrottle()
  }
}

export function initFrustrationObserver(lifeCycle, frustrationCb) {
  return lifeCycle.subscribe(
    LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
    function (data) {
      if (
        data.rawRumEvent.type === RumEventType.ACTION &&
        data.rawRumEvent.action.type === ActionType.CLICK &&
        data.rawRumEvent.action.frustration &&
        data.rawRumEvent.action.frustration.type &&
        data.rawRumEvent.action.frustration.type.length &&
        'events' in data.domainContext &&
        data.domainContext.events &&
        data.domainContext.events.length
      ) {
        frustrationCb({
          timestamp: data.rawRumEvent.date,
          type: RecordType.FrustrationRecord,
          data: {
            frustrationTypes: data.rawRumEvent.action.frustration.type,
            recordIds: map(data.domainContext.events, function (e) {
              return getRecordIdForEvent(e)
            })
          }
        })
      }
    }
  ).unsubscribe
}
function getEventTarget(event) {
  if (event.composed === true && isNodeShadowHost(event.target)) {
    return event.composedPath()[0]
  }
  return event.target
}
