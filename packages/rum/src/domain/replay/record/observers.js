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
  assign
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
    o.mutationController,
    o.mutationCb,
    o.configuration
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

  return function () {
    mutationHandler()
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

function initMutationObserver(mutationController, cb, configuration) {
  return startMutationObserver(mutationController, cb, configuration).stop
}

function initMoveObserver(cb) {
  var updatePosition = throttle(
    function (event) {
      var target = event.target
      if (hasSerializedNode(target)) {
        var commonEvent = isTouchEvent(event) ? event.changedTouches[0] : event
        var clientX = commonEvent.clientX
        var clientY = commonEvent.clientY
        var position = {
          id: getSerializedNodeId(target),
          timeOffset: 0,
          x: clientX,
          y: clientY
        }
        if (window.visualViewport) {
          var mouseEventCoordinates = convertMouseEventToLayoutCoordinates(
            clientX,
            clientY
          )
          var visualViewportX = mouseEventCoordinates.visualViewportX
          var visualViewportY = mouseEventCoordinates.visualViewportY
          position.x = visualViewportX
          position.y = visualViewportY
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
  [DOM_EVENT.MOUSE_UP]: MouseInteractionType.MouseUp,
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
    var target = event.target
    if (
      getNodePrivacyLevel(target, defaultPrivacyLevel) ===
        NodePrivacyLevel.HIDDEN ||
      !hasSerializedNode(target)
    ) {
      return
    }
    var commonEvent = isTouchEvent(event) ? event.changedTouches[0] : event
    var clientX = commonEvent.clientX
    var clientY = commonEvent.clientY
    var position = {
      id: getSerializedNodeId(target),
      type: eventTypeToMouseInteraction[event.type],
      x: clientX,
      y: clientY
    }
    if (window.visualViewport) {
      var mouseEventCoordinates = convertMouseEventToLayoutCoordinates(
        clientX,
        clientY
      )
      var visualViewportX = mouseEventCoordinates.visualViewportX
      var visualViewportY = mouseEventCoordinates.visualViewportY
      position.x = visualViewportX
      position.y = visualViewportY
    }

    var record = assign(
      { id: getRecordIdForEvent(event) },
      assembleIncrementalSnapshot(IncrementalSource.MouseInteraction, position)
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

function initScrollObserver(cb, defaultPrivacyLevel, elementsScrollPositions) {
  var updatePosition = throttle(function (event) {
    var target = event.target
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
  return addEventListener(document, DOM_EVENT.SCROLL, updatePosition, {
    capture: true,
    passive: true
  }).stop
}

function initViewportResizeObserver(cb) {
  return initViewportObservable().subscribe(cb).unsubscribe
}

export function initInputObserver(cb, defaultPrivacyLevel) {
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
    document,
    [DOM_EVENT.INPUT, DOM_EVENT.CHANGE],
    function (event) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        onElementChange(event.target)
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
          checkStyleSheetAndCallback(this.parentStyleSheet, function (id) {
            var path = getPathToNestedCSSRule(this)
            if (path) {
              path.push(index || 0)
              cb({ id: id, adds: [{ rule: rule, index: path }] })
            }
          })
        }
      }),
      instrumentMethodAndCallOriginal(cls.prototype, 'deleteRule', {
        before: function (index) {
          checkStyleSheetAndCallback(this.parentStyleSheet, function (id) {
            var path = getPathToNestedCSSRule(this)
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
    return each(instrumentationStoppers, function (stopper) {
      stopper.stop()
    })
  }
}

function initMediaInteractionObserver(mediaInteractionCb, defaultPrivacyLevel) {
  var handler = function (event) {
    var target = event.target
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
  var updateDimension = throttle(
    function () {
      cb(getVisualViewport())
    },
    VISUAL_VIEWPORT_OBSERVER_THRESHOLD,
    {
      trailing: false
    }
  )
  var cancelThrottle = updateDimension.cancel
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
