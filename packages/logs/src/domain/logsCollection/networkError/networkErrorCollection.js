import {
  ErrorSource,
  initXhrObservable,
  RequestType,
  initFetchObservable,
  computeStackTrace,
  toStackTraceString,
  noop,
  each,
  LifeCycleEventType,
  getStatusGroup,
  urlParse,
  replaceNumberCharByPath,
  tryToClone,
  readBytesFromStream
} from '@cloudcare/browser-core'
import { StatusType } from '../../logger'

export function startNetworkErrorCollection(configuration, lifeCycle) {
  if (!configuration.forwardErrorsToLogs) {
    return { stop: noop }
  }

  var xhrSubscription = initXhrObservable().subscribe(function (context) {
    if (context.state === 'complete') {
      handleCompleteRequest(RequestType.XHR, context, configuration)
    }
  })
  var fetchSubscription = initFetchObservable().subscribe(function (context) {
    if (context.state === 'complete') {
      handleCompleteRequest(RequestType.FETCH, context, configuration)
    }
  })

  function handleCompleteRequest(type, request) {
    if (
      !configuration.isIntakeUrl(request.url) &&
      (isRejected(request) ||
        isServerError(request) ||
        configuration.isServerError(request))
    ) {
      if ('xhr' in request) {
        computeXhrResponseData(
          request.xhr,
          configuration,
          onResponseDataAvailable
        )
      } else if (request.response) {
        computeFetchResponseText(
          request.response,
          configuration,
          onResponseDataAvailable
        )
      } else if (request.error) {
        computeFetchErrorText(
          request.error,
          configuration,
          onResponseDataAvailable
        )
      }
    }

    function onResponseDataAvailable(responseData) {
      var urlObj = urlParse(request.url).getParse()
      lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
        rawLogsEvent: {
          message:
            format(type) + ' error ' + request.method + ' ' + request.url,
          date: request.startClocks.timeStamp,
          error: {
            origin: ErrorSource.NETWORK, // Todo: Remove in the next major release
            stack: responseData || 'Failed to load'
          },
          http: {
            method: request.method, // Cast resource method because of case mismatch cf issue RUMF-1152
            status_code: request.status,
            url: request.url,
            statusGroup: getStatusGroup(request.status),
            urlHost: urlObj.Host,
            urlPath: urlObj.Path,
            urlPathGroup: replaceNumberCharByPath(urlObj.Path)
          },
          status: StatusType.error,
          origin: ErrorSource.NETWORK
        }
      })
    }
  }

  return {
    stop: function () {
      xhrSubscription.unsubscribe()
      fetchSubscription.unsubscribe()
    }
  }
}

// TODO: ideally, computeXhrResponseData should always call the callback with a string instead of
// `unknown`. But to keep backward compatibility, in the case of XHR with a `responseType` different
// than "text", the response data should be whatever `xhr.response` is. This is a bit confusing as
// Logs event 'stack' is expected to be a string. This should be changed in a future major version
// as it could be a breaking change.
export function computeXhrResponseData(xhr, configuration, callback) {
  if (typeof xhr.response === 'string') {
    callback(truncateResponseText(xhr.response, configuration))
  } else {
    callback(xhr.response)
  }
}

export function computeFetchErrorText(error, configuration, callback) {
  callback(
    truncateResponseText(
      toStackTraceString(computeStackTrace(error)),
      configuration
    )
  )
}

export function computeFetchResponseText(response, configuration, callback) {
  var clonedResponse = tryToClone(response)
  if (!clonedResponse || !clonedResponse.body) {
    // if the clone failed or if the body is null, let's not try to read it.
    callback()
  } else if (!window.TextDecoder) {
    // If the browser doesn't support TextDecoder, let's read the whole response then truncate it.
    //
    // This should only be the case on early versions of Edge (before they migrated to Chromium).
    // Even if it could be possible to implement a workaround for the missing TextDecoder API (using
    // a Blob and FileReader), we found another issue preventing us from reading only the first
    // bytes from the response: contrary to other browsers, when reading from the cloned response,
    // if the original response gets canceled, the cloned response is also canceled and we can't
    // know about it.  In the following illustration, the promise returned by `reader.read()` may
    // never be fulfilled:
    //
    // fetch('/').then((response) => {
    //   const reader = response.clone().body.getReader()
    //   readMore()
    //   function readMore() {
    //     reader.read().then(
    //       (result) => {
    //         if (result.done) {
    //           console.log('done')
    //         } else {
    //           readMore()
    //         }
    //       },
    //       () => console.log('error')
    //     )
    //   }
    //   response.body.getReader().cancel()
    // })
    clonedResponse.text().then(
      function (text) {
        return callback(truncateResponseText(text, configuration))
      },
      function (error) {
        return callback('Unable to retrieve response: ' + error)
      }
    )
  } else {
    truncateResponseStream(
      clonedResponse.body,
      configuration.requestErrorResponseLengthLimit,
      function (error, responseText) {
        if (error) {
          callback('Unable to retrieve response: ' + error)
        } else {
          callback(responseText)
        }
      }
    )
  }
}

function isRejected(request) {
  return request.status === 0 && request.responseType !== 'opaque'
}

function isServerError(request) {
  return request.status >= 500
}

function truncateResponseText(responseText, configuration) {
  if (responseText.length > configuration.requestErrorResponseLengthLimit) {
    return (
      responseText.substring(0, configuration.requestErrorResponseLengthLimit) +
      '...'
    )
  }
  return responseText
}

function format(type) {
  if (RequestType.XHR === type) {
    return 'XHR'
  }
  return 'Fetch'
}

function truncateResponseStream(stream, bytesLimit, callback) {
  readBytesFromStream(
    stream,
    function (error, bytes, limitExceeded) {
      if (error) {
        callback(error)
      } else {
        var responseText = new TextDecoder().decode(bytes)
        if (limitExceeded) {
          responseText += '...'
        }
        callback(undefined, responseText)
      }
    },
    {
      bytesLimit: bytesLimit,
      collectStreamBody: true
    }
  )
}
