import {
  LifeCycleEventType,
  HttpRequest,
  Batch,
  RumEventType,
  jsBirdge,
  processedMessageByDataMap
} from '@cloudcare/browser-core'
var setBridgeData = function (serverRumEvent) {
  var rowData = processedMessageByDataMap(serverRumEvent).rowData
  if (rowData) {
    jsBirdge.sendEvent({
      name: 'rum',
      data: rowData
    })
  }
}
var setBatchData = function (serverRumEvent, batch) {
  if (serverRumEvent.type === RumEventType.VIEW) {
    batch.upsert(serverRumEvent, serverRumEvent.view.id)
  } else {
    batch.add(serverRumEvent)
  }
}
export function startRumBatch(configuration, lifeCycle) {
  var batch = makeRumBatch(configuration, lifeCycle)
  lifeCycle.subscribe(
    LifeCycleEventType.RUM_EVENT_COLLECTED,
    function (serverRumEvent) {
      // 处理webview 情况
      if (configuration.isJsBirdge && jsBirdge.bridge) {
        setBridgeData(serverRumEvent)
      } else {
        setBatchData(serverRumEvent, batch)
      }
    }
  )
  return {
    stop: function () {
      batch.stop()
    }
  }
}

function makeRumBatch(configuration, lifeCycle) {
  var primaryBatch = createRumBatch(configuration.datakitUrl, function () {
    lifeCycle.notify(LifeCycleEventType.BEFORE_UNLOAD)
  })

  function createRumBatch(endpointUrl, unloadCallback) {
    return new Batch(
      new HttpRequest(endpointUrl, configuration.batchBytesLimit),
      configuration.maxBatchSize,
      configuration.batchBytesLimit,
      configuration.maxMessageSize,
      configuration.flushTimeout,
      unloadCallback
    )
  }

  var stopped = false
  return {
    add: function (message) {
      if (stopped) {
        return
      }
      primaryBatch.add(message)
    },
    stop: function () {
      stopped = true
    },
    upsert: function (message, key) {
      if (stopped) {
        return
      }
      primaryBatch.upsert(message, key)
    }
  }
}
