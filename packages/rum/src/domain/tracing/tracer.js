import {
  objectEntries,
  each,
  shallowClone,
  isArray,
  TraceType,
  getOrigin,
  performDraw,
  isNumber
} from '@cloudcare/browser-core'
import { DDtraceTracer } from './ddtraceTracer'
import { SkyWalkingTracer } from './skywalkingTracer'
import { JaegerTracer } from './jaegerTracer'
import { ZipkinSingleTracer } from './zipkinSingleTracer'
import { ZipkinMultiTracer } from './zipkinMultiTracer'
import { W3cTraceParentTracer } from './w3cTraceParentTracer'

export function clearTracingIfNeeded(context) {
  if (context.status === 0 && !context.isAborted) {
    context.traceId = undefined
    context.spanId = undefined
    context.traceSampled = undefined
  }
}

export function startTracer(configuration, sessionManager) {
  return {
    clearTracingIfNeeded: clearTracingIfNeeded,
    traceFetch: function (context) {
      return injectHeadersIfTracingAllowed(
        configuration,
        context,
        sessionManager,
        function (tracingHeaders) {
          if (
            context.input instanceof Request &&
            (!context.init || !context.init.headers)
          ) {
            context.input = new Request(context.input)
            each(tracingHeaders, function (value, key) {
              context.input.headers.append(key, value)
            })
          } else {
            context.init = shallowClone(context.init)
            var headers = []
            if (context.init.headers instanceof Headers) {
              context.init.headers.forEach(function (value, key) {
                headers.push([key, value])
              })
            } else if (isArray(context.init.headers)) {
              each(context.init.headers, function (header) {
                headers.push(header)
              })
            } else if (context.init.headers) {
              each(context.init.headers, function (value, key) {
                headers.push([key, value])
              })
            }
            // context.init.headers = headers.concat(objectEntries(tracingHeaders))
            // 转换成对象，兼容部分
            var headersMap = {}
            each(
              headers.concat(objectEntries(tracingHeaders)),
              function (header) {
                headersMap[header[0]] = header[1]
              }
            )
            context.init.headers = headersMap
          }
        }
      )
    },
    traceXhr: function (context, xhr) {
      return injectHeadersIfTracingAllowed(
        configuration,
        context,
        sessionManager,
        function (tracingHeaders) {
          each(tracingHeaders, function (value, name) {
            xhr.setRequestHeader(name, value)
          })
        }
      )
    }
  }
}
function isAllowedUrl(configuration, requestUrl) {
  var requestOrigin = getOrigin(requestUrl)
  var flag = false
  each(configuration.allowedTracingOrigins, function (allowedOrigin) {
    if (
      requestOrigin === allowedOrigin ||
      (allowedOrigin instanceof RegExp && allowedOrigin.test(requestOrigin))
    ) {
      flag = true
      return false
    }
  })
  return flag
}

export function injectHeadersIfTracingAllowed(
  configuration,
  context,
  sessionManager,
  inject
) {
  if (
    !isAllowedUrl(configuration, context.url) ||
    !configuration.traceType ||
    !sessionManager.findTrackedSession()
  ) {
    return
  }
  var traceSampled =
    !isNumber(configuration.tracingSampleRate) ||
    performDraw(configuration.tracingSampleRate)
  var tracer
  switch (configuration.traceType) {
    case TraceType.DDTRACE:
      tracer = new DDtraceTracer(traceSampled)
      break
    case TraceType.SKYWALKING_V3:
      tracer = new SkyWalkingTracer(configuration, context.url, traceSampled)
      break
    case TraceType.ZIPKIN_MULTI_HEADER:
      tracer = new ZipkinMultiTracer(configuration, traceSampled)
      break
    case TraceType.JAEGER:
      tracer = new JaegerTracer(configuration, traceSampled)
      break
    case TraceType.W3C_TRACEPARENT:
      tracer = new W3cTraceParentTracer(configuration, traceSampled)
      break
    case TraceType.ZIPKIN_SINGLE_HEADER:
      tracer = new ZipkinSingleTracer(configuration, traceSampled)
      break
    default:
      break
  }
  if (!tracer || !tracer.isTracingSupported()) {
    return
  }

  context.traceId = tracer.getTraceId()
  context.spanId = tracer.getSpanId()
  context.traceSampled = traceSampled
  inject(tracer.makeTracingHeaders())
}
