import { TraceIdentifier, getCrypto } from './traceIdentifier'

/**
 *
 * @param {*} traceSampled
 * @param {*} isHexTraceId 是否需要转换成10进制上报数据
 */
export function W3cTraceParentTracer(traceSampled, isHexTraceId) {
  this._traceId = new TraceIdentifier()
  this._spanId = new TraceIdentifier()
  this._traceSampled = traceSampled
  this.isHexTraceId = isHexTraceId
}
W3cTraceParentTracer.prototype = {
  isTracingSupported: function () {
    return getCrypto() !== undefined
  },
  getSpanId: function () {
    return this.isHexTraceId
      ? this._spanId.toDecimalString()
      : this._spanId.toPaddedHexadecimalString()
  },
  getTraceId: function () {
    return this.isHexTraceId
      ? this._traceId.toDecimalString()
      : '0000000000000000' + this._traceId.toPaddedHexadecimalString()
  },
  getTraceParent: function () {
    // '{version}-{traceId}-{spanId}-{sampleDecision}'
    return (
      '00-0000000000000000' +
      this._traceId.toPaddedHexadecimalString() +
      '-' +
      this._spanId.toPaddedHexadecimalString() +
      '-' +
      (this._traceSampled ? '01' : '00')
    )
  },
  makeTracingHeaders: function () {
    return {
      traceparent: this.getTraceParent()
    }
  }
}
