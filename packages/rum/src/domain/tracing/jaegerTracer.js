import { TraceIdentifier, getCrypto } from './traceIdentifier'

/**
 *
 * @param {*} configuration  配置信息
 */
export function JaegerTracer(configuration, traceSampled) {
  this._traceId = new TraceIdentifier()
  this._spanId = new TraceIdentifier()
  this._traceSampled = traceSampled
  this.is128Bit = configuration.traceId128Bit
}
JaegerTracer.prototype = {
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
  getUberTraceId: function () {
    //{trace-id}:{span-id}:{parent-span-id}:{flags}
    return (
      this.getTraceId() +
      ':' +
      this.getSpanId() +
      ':' +
      '0' +
      ':' +
      (this._traceSampled ? '1' : '0')
    )
  },
  makeTracingHeaders: function () {
    return {
      'uber-trace-id': this.getUberTraceId()
    }
  }
}
