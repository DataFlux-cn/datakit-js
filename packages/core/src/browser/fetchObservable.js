import { instrumentMethod } from '../helper/instrumentMethod'
import { Observable } from '../helper/observable'
import { clocksNow } from '../helper/tools'
import { monitor, callMonitored } from '../helper/monitor'
import { normalizeUrl } from '../helper/urlPolyfill'

var fetchObservable

export function initFetchObservable() {
  if (!fetchObservable) {
    fetchObservable = createFetchObservable()
  }
  return fetchObservable
}

function createFetchObservable() {
  return new Observable(function (observable) {
    if (!window.fetch) {
      return
    }

    var fetchMethod = instrumentMethod(
      window,
      'fetch',
      function (originalFetch) {
        return function (input, init) {
          var responsePromise
          var context = callMonitored(beforeSend, null, [
            observable,
            input,
            init
          ])
          if (context) {
            responsePromise = originalFetch.call(
              this,
              context.input,
              context.init
            )
            callMonitored(afterSend, null, [
              observable,
              responsePromise,
              context
            ])
          } else {
            responsePromise = originalFetch.call(this, input, init)
          }
          return responsePromise
        }
      }
    )
    return fetchMethod.stop
  })
}

function beforeSend(observable, input, init) {
  //   var method =
  //       (init && init.method) || (input instanceof Request && input.method) || 'GET'
  //     const methodFromParams =
  //       (init && init.method) || (input instanceof Request && input.method)
  //     const method = methodFromParams ? methodFromParams.toUpperCase() : 'GET'
  var methodFromParams = init && init.method

  if (methodFromParams === undefined && input instanceof Request) {
    methodFromParams = input.method
  }

  var method =
    methodFromParams !== undefined
      ? String(methodFromParams).toUpperCase()
      : 'GET'
  var url = input instanceof Request ? input.url : normalizeUrl(String(input))

  var startClocks = clocksNow()

  var context = {
    state: 'start',
    init: init,
    input: input,
    method: method,
    startClocks: startClocks,
    url: url
  }

  observable.notify(context)

  return context
}

function afterSend(observable, responsePromise, startContext) {
  var reportFetch = function (response) {
    var context = startContext
    context.state = 'resolve'
    // context.duration = elapsed(context.startClocks.timeStamp, timeStampNow())
    if ('stack' in response || response instanceof Error) {
      context.status = 0
      context.isAborted =
        response instanceof DOMException &&
        response.code === DOMException.ABORT_ERR
      context.error = response
    } else if ('status' in response) {
      context.response = response
      try {
        context.responseType =
          (response.constructor === Response && response.type) || '' // issue The Response type getter can only be used on instances of Response
      } catch (err) {
        context.responseType = ''
      }

      context.status = response.status
      context.isAborted = false
    }
    observable.notify(context)
  }
  responsePromise.then(monitor(reportFetch), monitor(reportFetch))
}
