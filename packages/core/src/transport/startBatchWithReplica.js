import { Batch } from './batch'
import { createHttpRequest } from './httpRequest'

export function startBatchWithReplica(
  configuration,
  endpointUrl,
  reportError
) {
  var primaryBatch = createBatch(endpointUrl)

  function createBatch(endpointUrl) {
    return new Batch(
      createHttpRequest(endpointUrl, configuration.batchBytesLimit, reportError),
      configuration.batchMessagesLimit,
      configuration.batchBytesLimit,
      configuration.messageBytesLimit,
      configuration.flushTimeout
    )
  }

  return {
    add: function(message) {
      primaryBatch.add(message)
    },
  }
}
