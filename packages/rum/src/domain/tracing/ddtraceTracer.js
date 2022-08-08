function TraceIdentifier() {
  this.buffer = new Uint8Array(8)
  getCrypto().getRandomValues(this.buffer)
  this.buffer[0] = this.buffer[0] & 0x7f
}

TraceIdentifier.prototype = {
  // buffer: new Uint8Array(8),
  toString: function (radix) {
    var high = this.readInt32(0)
    var low = this.readInt32(4)
    var str = ''

    while (1) {
      var mod = (high % radix) * 4294967296 + low

      high = Math.floor(high / radix)
      low = Math.floor(mod / radix)
      str = (mod % radix).toString(radix) + str

      if (!high && !low) {
        break
      }
    }
    return str
  },
  toDecimalString: function () {
    return this.toString(10)
  },

  readInt32: function (offset) {
    return (
      this.buffer[offset] * 16777216 +
      (this.buffer[offset + 1] << 16) +
      (this.buffer[offset + 2] << 8) +
      this.buffer[offset + 3]
    )
  }
}
function getCrypto() {
  return window.crypto || window.msCrypto
}
/**
 * 
 * @param {*} configuration  配置信息
 */
export function DDtraceTracer(configuration) {
   this._spanId = new TraceIdentifier().toDecimalString()
   this._traceId = new TraceIdentifier().toDecimalString()
}
DDtraceTracer.prototype = {
  isTracingSupported: function() {
    return getCrypto() !== undefined
  },
  getSpanId:function() {
    return this._spanId
  },
  getTraceId: function() {
    return this._traceId
  },
  makeTracingHeaders: function() {
    return {
      'x-datadog-origin': 'rum',
      'x-datadog-parent-id': '0',
      'x-datadog-sampled': '1',
      'x-datadog-sampling-priority': '1',
      'x-datadog-trace-id': this.getTraceId()
    }
  }
}