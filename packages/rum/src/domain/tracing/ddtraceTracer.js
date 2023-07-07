import { TraceIdentifier, getCrypto } from './traceIdentifier'
/**
 *
 * @param {*} configuration  配置信息
 */
export function DDtraceTracer(traceSampled) {
  this._spanId = new TraceIdentifier()
  this._traceId = new TraceIdentifier()
  this._traceSampled = traceSampled
}
DDtraceTracer.prototype = {
  isTracingSupported: function () {
    return getCrypto() !== undefined
  },
  getSpanId: function () {
    return this._spanId.toDecimalString()
  },
  getTraceId: function () {
    return this._traceId.toDecimalString()
  },
  makeTracingHeaders: function () {
    return {
      'x-datadog-origin': 'rum',
      'x-datadog-parent-id': this.getSpanId(),
      'x-datadog-sampling-priority': this._traceSampled ? '2' : '-1',
      'x-datadog-trace-id': this.getTraceId()
    }
  }
}
