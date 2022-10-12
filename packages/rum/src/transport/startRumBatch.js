import { Batch, createHttpRequest, LifeCycleEventType, RumEventType } from '@cloudcare/browser-core'

export function startRumBatch(
  configuration,
  lifeCycle,
  reportError
) {
  var batch = makeRumBatch(configuration, lifeCycle, reportError)

  lifeCycle.subscribe(LifeCycleEventType.RUM_EVENT_COLLECTED, function(serverRumEvent){
    if (serverRumEvent.type === RumEventType.VIEW) {
      batch.upsert(serverRumEvent, serverRumEvent.view.id)
    } else {
      batch.add(serverRumEvent)
    }
  })
}



function makeRumBatch(
  configuration,
  lifeCycle,
  reportError
) {
  var primaryBatch = createRumBatch(configuration.datakitUrl, function() {
    lifeCycle.notify(LifeCycleEventType.BEFORE_UNLOAD)
  })
  function createRumBatch(endpointUrl, unloadCallback) {
    return new Batch(
      createHttpRequest(endpointUrl, configuration.batchBytesLimit, reportError),
      configuration.batchMessagesLimit,
      configuration.batchBytesLimit,
      configuration.messageBytesLimit,
      configuration.flushTimeout,
      unloadCallback
    )
  }

  return {
    add: function(message){
      primaryBatch.add(message)
    },
    upsert: function(message, key){
      primaryBatch.upsert(message, key)
    },
  }
}
