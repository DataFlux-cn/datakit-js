import {
  objectEntries,
  each,
  shallowClone,
  isArray,
  TraceType,
  getOrigin
} from '@cloudcare/browser-core'
import { DDtraceTracer} from './ddtraceTracer'
import { SkyWalkingTracer} from './skywalkingTracer'
import { JaegerTracer} from './jaegerTracer'
import { ZipkinSingleTracer} from './zipkinSingleTracer'
import { ZipkinMultiTracer} from './zipkinMultiTracer'
import { W3cTraceParentTracer} from './w3cTraceParentTracer'

export function clearTracingIfCancelled(context) {
  if (context.status === 0) {
    context.traceId = undefined
    context.spanId = undefined
  }
}

export function startTracer(configuration) {
  return {
    clearTracingIfCancelled: clearTracingIfCancelled,
    traceFetch: function (context) {
      return injectHeadersIfTracingAllowed(
        configuration,
        context,
        function (tracingHeaders) {
          // if (context.input instanceof Request && (context.init))
          
          if (context.input instanceof Request && (!context.init || !context.init.headers)) {
            context.input = new Request(context.input)
            each(tracingHeaders, function(value,key) {
              context.input.headers.append(key, value)
            })
            
          } else {
            context.init = shallowClone(context.init)
            var headers = []
            if (context.init.headers instanceof Headers) {
              each(context.init.headers, function (value, key) {
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
            each(headers.concat(objectEntries(tracingHeaders)), function(header){
              headersMap[header[0]] = header[1]
            })
            context.init.headers = headersMap
            
          }
          
        }
      )
    },
    traceXhr: function (context, xhr) {
      return injectHeadersIfTracingAllowed(
        configuration,
        context,
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

export function injectHeadersIfTracingAllowed(configuration, context, inject) {
  if (!isAllowedUrl(configuration, context.url) || !configuration.traceType) {
    return
  }
  var tracer;
  switch(configuration.traceType) {
    case TraceType.DDTRACE: 
      tracer = new DDtraceTracer();
      break;
    case TraceType.SKYWALKING_V3:
      tracer = new SkyWalkingTracer(configuration, context.url);
      break;
    case TraceType.ZIPKIN_MULTI_HEADER:
      tracer = new ZipkinMultiTracer(configuration);
      break;
    case TraceType.JAEGER:
      tracer = new JaegerTracer(configuration);
      break;
    case TraceType.W3C_TRACEPARENT:
      tracer = new W3cTraceParentTracer(configuration);
      break;
      case TraceType.ZIPKIN_SINGLE_HEADER:
        tracer = new ZipkinSingleTracer(configuration);
        break;
    default:
      break;
  }
  if (!tracer || !tracer.isTracingSupported()) {
    return
  }

  context.traceId = tracer.getTraceId()
  context.spanId = tracer.getSpanId()
  inject(tracer.makeTracingHeaders())
}
