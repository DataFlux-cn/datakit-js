import { startBatchWithReplica, LifeCycleEventType } from '@cloudcare/browser-core'

export function startLogsBatch(
  configuration,
  lifeCycle,
  reportError
) {
  var batch = startBatchWithReplica(
    configuration,
    configuration.logsEndpoint,
    reportError
  )

  lifeCycle.subscribe(LifeCycleEventType.LOG_COLLECTED, function(serverLogsEvent) {
    batch.add(serverLogsEvent)
  })
}
