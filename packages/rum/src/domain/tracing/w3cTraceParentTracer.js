// === Generate a random 64-bit number in fixed-length hex format
function randomTraceId() {
  const digits = '0123456789abcdef';
  let n = '';
  for (let i = 0; i < 16; i += 1) {
    const rand = Math.floor(Math.random() * 16);
    n += digits[rand];
  }
  return n;
}

/**
 * 
 * @param {*} configuration  配置信息
 */
 export function W3cTraceParentTracer(configuration) {
  const rootSpanId = randomTraceId();
  this._traceId = randomTraceId() + rootSpanId
  this._spanId = rootSpanId
}
W3cTraceParentTracer.prototype = {
 isTracingSupported: function() {
   return true
 },
 getSpanId:function() {
   return this._spanId
 },
 getTraceId: function() {
   return this._traceId
 },
 getTraceParent: function() {
  // '{version}-{traceId}-{spanId}-{sampleDecision}'
  return '00-' + this._traceId + '-' + this._spanId + '-01'
 },
 makeTracingHeaders: function() {
   return {
     'traceparent': this.getTraceParent()
   }
 }
}