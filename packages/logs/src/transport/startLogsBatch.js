import {
  startBatchWithReplica,
  LifeCycleEventType
} from '@cloudcare/browser-core'

export function startLogsBatch(
  configuration,
  lifeCycle,
  reportError,
  pageExitObservable,
  sessionExpireObservable
) {
  var batch = startBatchWithReplica(
    configuration,
    configuration.logsEndpoint,
    reportError,
    pageExitObservable,
    sessionExpireObservable
  )

  lifeCycle.subscribe(
    LifeCycleEventType.LOG_COLLECTED,
    function (serverLogsEvent) {
      batch.add(serverLogsEvent)
    }
  )
}
