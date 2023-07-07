import { TraceIdentifier, getCrypto } from './traceIdentifier'

/**
 *
 * @param {*} configuration  配置信息
 */
export function ZipkinMultiTracer(configuration, traceSampled) {
  this._traceId = new TraceIdentifier()
  this._spanId = new TraceIdentifier()
  this._traceSampled = traceSampled
  this.is128Bit = configuration.traceId128Bit
}
ZipkinMultiTracer.prototype = {
  isTracingSupported: function () {
    return getCrypto() !== undefined
  },
  getSpanId: function () {
    return this._spanId.toPaddedHexadecimalString()
  },
  getTraceId: function () {
    return this.is128Bit
      ? '0000000000000000' + this._traceId.toPaddedHexadecimalString()
      : this._traceId.toPaddedHexadecimalString()
  },

  makeTracingHeaders: function () {
    return {
      'X-B3-TraceId': this.getSpanId(),
      'X-B3-SpanId': this.getTraceId(),
      //  'X-B3-ParentSpanId': '',
      'X-B3-Sampled': this._traceSampled ? '1' : '0'
      //  'X-B3-Flags': '0'
    }
  }
}
