import {
  timeStampNow,
  Observable,
  assign,
  getRelativeTime,
  ONE_MINUTE,
  ContextHistory,
  UUID,
  clocksNow,
  ONE_SECOND,
  elapsed,
  each,
  map,
  LifeCycleEventType,
  ActionType,
  isNullUndefinedDefaultValue
} from '@cloudcare/browser-core'
import { trackEventCounts } from '../../trackEventCounts'
import { waitPageActivityEnd } from '../../waitPageActivityEnd'
import { createClickChain } from './clickChain'
import { getActionNameFromElement } from './getActionNameFromElement'
// import { getSelectorsFromElement } from './getSelectorsFromElement'
import { listenActionEvents } from './listenActionEvents'
import { computeFrustration } from './computeFrustration'


// Maximum duration for click actions
export var CLICK_ACTION_MAX_DURATION = 10 * ONE_SECOND
export var ACTION_CONTEXT_TIME_OUT_DELAY = 5 * ONE_MINUTE // arbitrary

export function trackClickActions(
  lifeCycle,
  domMutationObservable,
  configuration
) {
  var history = new ContextHistory(ACTION_CONTEXT_TIME_OUT_DELAY)
  var stopObservable = new Observable()
  var trackFrustrations = configuration.trackFrustrations
  var currentClickChain

  lifeCycle.subscribe(LifeCycleEventType.SESSION_RENEWED, function(){
    history.reset()
  })
  lifeCycle.subscribe(LifeCycleEventType.BEFORE_UNLOAD, stopClickChain)
  lifeCycle.subscribe(LifeCycleEventType.VIEW_ENDED, stopClickChain)
  var _listenActionEvents = listenActionEvents({
    onPointerDown: function(pointerDownEvent) { return processPointerDown(configuration, pointerDownEvent) },
    onClick: function(clickActionBase, clickEvent, getUserActivity) {
      return processClick(
        configuration,
        lifeCycle,
        domMutationObservable,
        history,
        stopObservable,
        appendClickToClickChain,
        clickActionBase,
        clickEvent,
        getUserActivity
      )
    }
  })
  var stopActionEventsListener = _listenActionEvents.stop
  var actionContexts = {
    findActionId: function(startTime) {
      return configuration.trackFrustrations ? history.findAll(startTime) : history.find(startTime)
    }
  }

  return {
    stop:function(){
      stopClickChain()
      stopObservable.notify()
      stopActionEventsListener()
    },
    actionContexts: actionContexts
  }

  function stopClickChain() {
    if (currentClickChain) {
      currentClickChain.stop()
    }
  }
  function appendClickToClickChain(click) {
    if (!currentClickChain || !currentClickChain.tryAppend(click)) {
      var rageClick = click.clone()
      currentClickChain = createClickChain(click, function(clicks) {
        finalizeClicks(clicks, rageClick)
      })
    }
  }
  function processPointerDown(
    configuration,
    pointerDownEvent
  ) {

    var clickActionBase = computeClickActionBase(pointerDownEvent, configuration.actionNameAttribute)
    return clickActionBase
  }
  function processClick(configuration,lifeCycle,domMutationObservable,history,stopObservable,appendClickToClickChain,clickActionBase,clickEvent,getUserActivity) {
      var click = newClick(lifeCycle, history, getUserActivity, clickActionBase, clickEvent)
      if (configuration.trackFrustrations) {
        appendClickToClickChain(click)
      }
  
      var _waitPageActivityEnd = waitPageActivityEnd(
        lifeCycle,
        domMutationObservable,
        configuration,
        function(pageActivityEndEvent) {
          if (pageActivityEndEvent.hadActivity && pageActivityEndEvent.end < click.startClocks.timeStamp) {
            // If the clock is looking weird, just discard the click
            click.discard()
          } else {
            click.stop(pageActivityEndEvent.hadActivity ? pageActivityEndEvent.end : undefined)
    
            // Validate or discard the click only if we don't track frustrations. It'll be done when
            // the click chain is finalized.
            if (!configuration.trackFrustrations) {
              if (!pageActivityEndEvent.hadActivity) {
                // If we are not tracking frustrations, we should discard the click to keep backward
                // compatibility.
                click.discard()
              } else {
                click.validate()
              }
            }
          }
        },
        CLICK_ACTION_MAX_DURATION
      )
    
      var viewEndedSubscription = lifeCycle.subscribe(LifeCycleEventType.VIEW_ENDED, function(data) {
        click.stop(data.endClocks.timeStamp)
      })
    
      var stopSubscription = stopObservable.subscribe(function() {
        click.stop()
      })
    
      click.stopObservable.subscribe(function() {
        viewEndedSubscription.unsubscribe()
        _waitPageActivityEnd.stop()
        stopSubscription.unsubscribe()
      })
  }
}

function computeClickActionBase(event, actionNameAttribute) {
  var target
  var position

  // if (isExperimentalFeatureEnabled('clickmap')) {
  //   var rect = event.target.getBoundingClientRect()
  //   target = assign(
  //     {
  //       width: Math.round(rect.width),
  //       height: Math.round(rect.height),
  //     },
  //     getSelectorsFromElement(event.target, actionNameAttribute)
  //   )
  //   position = {
  //     // Use clientX and Y because for SVG element offsetX and Y are relatives to the <svg> element
  //     x: Math.round(event.clientX - rect.left),
  //     y: Math.round(event.clientY - rect.top),
  //   }
  // }

  return {
    type: 'click',
    target: target,
    position: position,
    name: getActionNameFromElement(event.target, actionNameAttribute),
  }
}

var ClickStatus  = {
  // Initial state, the click is still ongoing.
  ONGOING: 'ONGOING',
  // The click is no more ongoing but still needs to be validated or discarded.
  STOPPED: 'STOPPED',
  // Final state, the click has been stopped and validated or discarded.
  FINALIZED: 'FINALIZED',
}


function newClick(
  lifeCycle,
  history,
  getUserActivity,
  clickActionBase,
  clickEvent
) {
  var id = UUID()
  var startClocks = clocksNow()
  var historyEntry = history.add(id, startClocks.relative)
  var eventCountsSubscription = trackEventCounts(lifeCycle)
  var status = ClickStatus.ONGOING
  var activityEndTime
  var frustrationTypes = []
  var stopObservable = new Observable()

  function stop(newActivityEndTime) {
    if (status !== ClickStatus.ONGOING) {
      return
    }
    activityEndTime = newActivityEndTime
    status = ClickStatus.STOPPED
    if (activityEndTime) {
      historyEntry.close(getRelativeTime(activityEndTime))
    } else {
      historyEntry.remove()
    }
    eventCountsSubscription.stop()
    stopObservable.notify()
  }

  return {
    event: clickEvent,
    stop: stop,
    startClocks: startClocks,
    stopObservable: stopObservable,
    hasError: eventCountsSubscription.eventCounts.errorCount > 0,
    hasPageActivity: activityEndTime !== undefined,
    getUserActivity: getUserActivity,
    addFrustration: function(frustrationType) {
      frustrationTypes.push(frustrationType)
    },

    isStopped: function() { return status === ClickStatus.STOPPED || status === ClickStatus.FINALIZED },

    clone: function() { return newClick(lifeCycle, history, getUserActivity, clickActionBase, clickEvent) },

    validate: function(domEvents){
      stop()
      if (status !== ClickStatus.STOPPED) {
        return
      }
      var _eventCountsSubscription = eventCountsSubscription.eventCounts
      var resourceCount = _eventCountsSubscription.resourceCount
      var errorCount = _eventCountsSubscription.errorCount
      var longTaskCount = _eventCountsSubscription.longTaskCount
      var clickAction = assign(
        {
          type: ActionType.CLICK,
          duration: activityEndTime && elapsed(startClocks.timeStamp, activityEndTime),
          startClocks: startClocks, 
          id: id,
          frustrationTypes: frustrationTypes,
          counts: {
            resourceCount,
            errorCount,
            longTaskCount,
          },
          events: isNullUndefinedDefaultValue(domEvents, [clickEvent]),
          event: clickEvent
        },
        clickActionBase
      )
      lifeCycle.notify(LifeCycleEventType.AUTO_ACTION_COMPLETED, clickAction)
      status = ClickStatus.FINALIZED
    },

    discard: function(){
      stop()
      status = ClickStatus.FINALIZED
    },
  }
}

export function finalizeClicks(clicks, rageClick) {
  var _computeFrustration = computeFrustration(clicks, rageClick)
  var isRage = _computeFrustration.isRage
  if (isRage) {
    each(clicks, function(click) {
      click.discard()
    })
    rageClick.stop(timeStampNow())
    rageClick.validate(map(clicks, function(click) { return click.event}))
  } else {
    rageClick.discard()
    each(clicks, function(click) {
      click.validate()
    })
  }
}
