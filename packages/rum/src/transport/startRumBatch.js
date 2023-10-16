import {
  Batch,
  createHttpRequest,
  LifeCycleEventType,
  RumEventType,
  createFlushController
} from '@cloudcare/browser-core'

export function startRumBatch(
  configuration,
  lifeCycle,
  telemetryEventObservable,
  reportError,
  pageExitObservable,
  sessionExpireObservable
) {
  var batch = makeRumBatch(
    configuration,
    reportError,
    pageExitObservable,
    sessionExpireObservable
  )

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
  telemetryEventObservable.subscribe(function (event) {
    batch.add(event)
  })
}

function makeRumBatch(
  configuration,
  reportError,
  pageExitObservable,
  sessionExpireObservable
) {
  var rumBatch = createRumBatch(configuration.rumEndpoint)
  var primaryBatch = rumBatch.batch
  var primaryFlushController = rumBatch.flushController
  function createRumBatch(endpointUrl) {
    var flushController = createFlushController({
      messagesLimit: configuration.batchMessagesLimit,
      bytesLimit: configuration.batchBytesLimit,
      durationLimit: configuration.flushTimeout,
      pageExitObservable: pageExitObservable,
      sessionExpireObservable: sessionExpireObservable
    })
    var batch = new Batch(
      createHttpRequest(
        endpointUrl,
        configuration.batchBytesLimit,
        configuration.sendContentTypeByJson,
        reportError
      ),
      flushController,
      configuration.messageBytesLimit,
      configuration.sendContentTypeByJson
    )
    return {
      batch: batch,
      flushController: flushController
    }
  }

  return {
    flushObservable: primaryFlushController.flushObservable,
    add: function (message) {
      primaryBatch.add(message)
    },
    upsert: function (message, key) {
      primaryBatch.upsert(message, key)
    }
  }
}
