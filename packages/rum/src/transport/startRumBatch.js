import {
  Batch,
  createHttpRequest,
  LifeCycleEventType,
  RumEventType
} from '@cloudcare/browser-core'

export function startRumBatch(
  configuration,
  lifeCycle,
  reportError,
  pageExitObservable
) {
  var batch = makeRumBatch(configuration, reportError, pageExitObservable)

  lifeCycle.subscribe(
    LifeCycleEventType.RUM_EVENT_COLLECTED,
    function (serverRumEvent) {
      if (serverRumEvent.type === RumEventType.VIEW) {
        batch.upsert(serverRumEvent, serverRumEvent.view.id)
      } else {
        batch.add(serverRumEvent)
      }
    }
  )
}

function makeRumBatch(configuration, reportError, pageExitObservable) {
  var primaryBatch = createRumBatch(configuration.datakitUrl)
  function createRumBatch(endpointUrl, unloadCallback) {
    return new Batch(
      createHttpRequest(
        endpointUrl,
        configuration.batchBytesLimit,
        reportError
      ),
      configuration.batchMessagesLimit,
      configuration.batchBytesLimit,
      configuration.messageBytesLimit,
      configuration.flushTimeout,
      pageExitObservable
    )
  }

  return {
    add: function (message) {
      primaryBatch.add(message)
    },
    upsert: function (message, key) {
      primaryBatch.upsert(message, key)
    }
  }
}
