import { TraceIdentifier, getCrypto } from './traceIdentifier'

/**
 *
 * @param {*} configuration  配置信息
 */
export function ZipkinSingleTracer(configuration, traceSampled) {
  this._traceId = new TraceIdentifier()
  this._spanId = new TraceIdentifier()
  this._traceSampled = traceSampled
}
ZipkinSingleTracer.prototype = {
  isTracingSupported: function () {
    return getCrypto() !== undefined
  },
  getSpanId: function () {
    return this._spanId.toPaddedHexadecimalString()
  },
  getTraceId: function () {
    return this._traceId.toPaddedHexadecimalString()
  },
  getB3Str: function () {
    //{TraceId}-{SpanId}-{SamplingState}-{ParentSpanId}
    return (
      this.getTraceId() +
      '-' +
      this.getSpanId() +
      '-' +
      (this._traceSampled ? '1' : '0')
    )
  },
  makeTracingHeaders: function () {
    return {
      b3: this.getB3Str()
    }
  }
}
