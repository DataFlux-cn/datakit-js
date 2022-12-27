import {
  startBatchWithReplica,
  LifeCycleEventType
} from '@cloudcare/browser-core'

export function startLogsBatch(
  configuration,
  lifeCycle,
  reportError,
  pageExitObservable
) {
  var batch = startBatchWithReplica(
    configuration,
    configuration.logsEndpoint,
    reportError,
    pageExitObservable
  )

  lifeCycle.subscribe(
    LifeCycleEventType.LOG_COLLECTED,
    function (serverLogsEvent) {
      batch.add(serverLogsEvent)
    }
  )
}
