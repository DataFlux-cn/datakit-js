import {
  LifeCycleEventType,
  HttpRequest,
  Batch,
  RumEventType,
  JsBirdge,
  processedMessageByDataMap
} from '@cloudcare/browser-core'
var setBridgeData = function (serverRumEvent, jsBirdge) {
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
  var jsBirdge
  if (configuration.isJsBirdge) {
    jsBirdge = new JsBirdge(configuration)
  }
  lifeCycle.subscribe(
    LifeCycleEventType.RUM_EVENT_COLLECTED,
    function (serverRumEvent) {
      // 处理webview 情况
      if (jsBirdge && jsBirdge.bridge) {
        setBridgeData(serverRumEvent, jsBirdge)
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
      new HttpRequest(endpointUrl, configuration.batchBytesLimit, configuration.isLineProtocolToJson),
      configuration.maxBatchSize,
      configuration.batchBytesLimit,
      configuration.maxMessageSize,
      configuration.flushTimeout,
      configuration.isLineProtocolToJson,
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
