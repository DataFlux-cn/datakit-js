import {
  addEventListener,
  elapsed,
  UUID,
  clocksNow,
  preferredClock,
  ActionType,
  DOM_EVENT,
  LifeCycleEventType
} from '@cloudcare/browser-core'
import { trackEventCounts } from '../../trackEventCounts'
import { waitIdlePageActivity } from '../../trackPageActivities'
import { getActionNameFromElement } from './getActionNameFromElement'

export function trackActions(lifeCycle) {
  var action = startActionManagement(lifeCycle)

  // New views trigger the discard of the current pending Action
  lifeCycle.subscribe(LifeCycleEventType.VIEW_CREATED, function () {
    action.discardCurrent()
  })
  var _addEventListener = addEventListener(
    window,
    DOM_EVENT.CLICK,
    function (event) {
      if (!(event.target instanceof Element)) {
        return
      }
      var name = getActionNameFromElement(event.target)
      if (!name) {
        return
      }
      action.create(ActionType.CLICK, name)
    },
    { capture: true }
  )
  var stopListener = _addEventListener.stop
  return {
    stop: function () {
      action.discardCurrent()
      stopListener()
    }
  }
}

function startActionManagement(lifeCycle) {
  var currentAction
  var currentIdlePageActivitySubscription

  return {
    create: function (type, name) {
      if (currentAction) {
        // Ignore any new action if another one is already occurring.
        return
      }
      var pendingAutoAction = new PendingAutoAction(lifeCycle, type, name)

      currentAction = pendingAutoAction
      currentIdlePageActivitySubscription = waitIdlePageActivity(
        lifeCycle,
        function (params) {
          if (params.hadActivity) {
            pendingAutoAction.complete(params.endTime)
          } else {
            pendingAutoAction.discard()
          }
          currentAction = undefined
        }
      )
    },
    discardCurrent: function () {
      if (currentAction) {
        currentIdlePageActivitySubscription.stop()
        currentAction.discard()
        currentAction = undefined
      }
    }
  }
}
var PendingAutoAction = function (lifeCycle, type, name) {
  this.id = UUID()
  this.startClocks = clocksNow()
  this.name = name
  this.type = type
  this.lifeCycle = lifeCycle
  this.eventCountsSubscription = trackEventCounts(lifeCycle)
  this.lifeCycle.notify(LifeCycleEventType.AUTO_ACTION_CREATED, {
    id: this.id,
    startClocks: this.startClocks
  })
}
PendingAutoAction.prototype = {
  complete: function (endTime) {
    var eventCounts = this.eventCountsSubscription.eventCounts
    this.lifeCycle.notify(LifeCycleEventType.AUTO_ACTION_COMPLETED, {
      counts: {
        errorCount: eventCounts.errorCount,
        longTaskCount: eventCounts.longTaskCount,
        resourceCount: eventCounts.resourceCount
      },
      duration: elapsed(preferredClock(this.startClocks), endTime),
      id: this.id,
      name: this.name,
      startClocks: this.startClocks,
      type: this.type
    })
    this.eventCountsSubscription.stop()
  },
  discard: function () {
    this.lifeCycle.notify(LifeCycleEventType.AUTO_ACTION_DISCARDED)
    this.eventCountsSubscription.stop()
  }
}
