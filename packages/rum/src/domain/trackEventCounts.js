import { noop, RumEventType, LifeCycleEventType } from '@cloudcare/browser-core'

export function trackEventCounts(lifeCycle, callback) {
  if (typeof callback === 'undefined') {
    callback = noop
  }
  var eventCounts = {
    errorCount: 0,
    longTaskCount: 0,
    resourceCount: 0,
    actionCount: 0,
    frustrationCount: 0,
  }

  var subscription = lifeCycle.subscribe(
    LifeCycleEventType.RUM_EVENT_COLLECTED,
    function (event) {
      switch (event.type) {
        case RumEventType.ERROR:
          eventCounts.errorCount += 1
          
          callback(eventCounts)
          break
        case RumEventType.ACTION:
          if (event.action.frustration) {
            eventCounts.frustrationCount += event.action.frustration.type.length
          }
          eventCounts.actionCount += 1
          callback(eventCounts)
          break
        case RumEventType.LONG_TASK:
          eventCounts.longTaskCount += 1
          callback(eventCounts)
          break
        case RumEventType.RESOURCE:
          eventCounts.resourceCount += 1
          callback(eventCounts)
          break
      }
    }
  )

  return {
    stop: function () {
      subscription.unsubscribe()
    },
    eventCounts: eventCounts
  }
}
