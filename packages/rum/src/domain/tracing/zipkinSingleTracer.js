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
 export function ZipkinSingleTracer(configuration) {
  const rootSpanId = randomTraceId();
  this._traceId = randomTraceId() + rootSpanId
  this._spanId = rootSpanId
}
ZipkinSingleTracer.prototype = {
 isTracingSupported: function() {
   return true
 },
 getSpanId:function() {
   return this._spanId
 },
 getTraceId: function() {
   return this._traceId
 },
 getB3Str: function() {
   //{TraceId}-{SpanId}-{SamplingState}-{ParentSpanId}
  return this._traceId + '-' + this._spanId + '-1' 
 },
 makeTracingHeaders: function() {
   return {
     'b3': this.getB3Str()
   }
 }
}