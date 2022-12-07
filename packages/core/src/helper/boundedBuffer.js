import { each } from './tools'
var BUFFER_LIMIT = 500

var _BoundedBuffer = function () {
  this.buffer = []
}
_BoundedBuffer.prototype = {
  add: function (callback) {
    var length = this.buffer.push(callback)
    if (length > BUFFER_LIMIT) {
      this.buffer.splice(0, 1)
    }
  },

  drain: function () {
    each(this.buffer, function (callback) {
      callback()
    })
    this.buffer.length = 0
  }
}
export var BoundedBuffer = _BoundedBuffer
