import {
  toServerDuration,
  relativeToClocks,
  RumEventType,
  LifeCycleEventType,
  UUID
} from '@cloudcare/browser-core'
export function startLongTaskCollection(lifeCycle, sessionManager) {
  lifeCycle.subscribe(
    LifeCycleEventType.PERFORMANCE_ENTRIES_COLLECTED,
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i]
        if (entry.entryType !== 'longtask') {
          return
        }
        var session = sessionManager.findTrackedSession(entry.startTime)
        if (!session) {
          break
        }

        var startClocks = relativeToClocks(entry.startTime)
        var rawRumEvent = {
          date: startClocks.timeStamp,
          long_task: {
            id: UUID(),
            duration: toServerDuration(entry.duration)
          },
          type: RumEventType.LONG_TASK
        }
        lifeCycle.notify(LifeCycleEventType.RAW_RUM_EVENT_COLLECTED, {
          rawRumEvent: rawRumEvent,
          startTime: startClocks.relative,
          domainContext: { performanceEntry: entry.toJSON() }
        })
      }
    }
  )
}
