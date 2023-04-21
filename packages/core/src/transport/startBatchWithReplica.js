import { Batch } from './batch'
import { createHttpRequest } from './httpRequest'
import { createFlushController } from './flushController'
export function startBatchWithReplica(
  configuration,
  endpointUrl,
  reportError,
  pageExitObservable,
  sessionExpireObservable
) {
  var primaryBatch = createBatch(endpointUrl)

  function createBatch(endpointUrl) {
    return new Batch(
      createHttpRequest(
        endpointUrl,
        configuration.batchBytesLimit,
        reportError
      ),
      createFlushController({
        messagesLimit: configuration.batchMessagesLimit,
        bytesLimit: configuration.batchBytesLimit,
        durationLimit: configuration.flushTimeout,
        pageExitObservable: pageExitObservable,
        sessionExpireObservable: sessionExpireObservable
      }),
      configuration.messageBytesLimit
    )
  }

  return {
    add: function (message) {
      primaryBatch.add(message)
    }
  }
}
