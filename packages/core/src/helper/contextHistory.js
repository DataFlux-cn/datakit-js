import { relativeNow, ONE_MINUTE, filter, map, addDuration } from './tools'
import { setInterval, clearInterval } from './timer'
var END_OF_TIMES = Infinity

export var CLEAR_OLD_CONTEXTS_INTERVAL = ONE_MINUTE
export function ContextHistory(expireDelay, maxEntries) {
  this.expireDelay = expireDelay
  this.entries = []
  this.maxEntries = maxEntries
  var _this = this
  this.clearOldContextsInterval = setInterval(function () {
    _this.clearOldContexts()
  }, CLEAR_OLD_CONTEXTS_INTERVAL)
}

ContextHistory.prototype.add = function (context, startTime) {
  var _this = this
  var entry = {
    context: context,
    startTime: startTime,
    endTime: END_OF_TIMES,
    remove: function () {
      var index = _this.entries.indexOf(entry)
      if (index >= 0) {
        _this.entries.splice(index, 1)
      }
    },
    close: function (endTime) {
      entry.endTime = endTime
    }
  }
  if (this.maxEntries && this.entries.length >= this.maxEntries) {
    this.entries.pop()
  }
  this.entries.unshift(entry)
  return entry
}
ContextHistory.prototype.find = function (startTime) {
  if (typeof startTime === 'undefined') {
    startTime = END_OF_TIMES
  }
  for (var entry of this.entries) {
    if (entry.startTime <= startTime) {
      if (startTime <= entry.endTime) {
        return entry.context
      }
      break
    }
  }
  //
}
/**
 * Helper function to close the currently active context, if any. This method assumes that entries
 * are not overlapping.
 */
ContextHistory.prototype.closeActive = function (endTime) {
  var latestEntry = this.entries[0]
  if (latestEntry && latestEntry.endTime === END_OF_TIMES) {
    latestEntry.close(endTime)
  }
}
/**
 * Return all contexts that were active during `startTime`, or all currently active contexts if no
 * `startTime` is provided.
 */
ContextHistory.prototype.findAll = function (startTime, duration) {
  if (typeof duration === 'undefined') {
    duration = 0
  }
  if (typeof startTime === 'undefined') {
    startTime = END_OF_TIMES
  }
  var endTime = addDuration(startTime, duration)
  var result = filter(this.entries, function (entry) {
    return entry.startTime <= endTime && startTime <= entry.endTime
  })
  return map(result, function (entry) {
    return entry.context
  })
}
/**
 * Remove all entries from this collection.
 */
ContextHistory.prototype.reset = function () {
  this.entries = []
}
/**
 * Stop internal garbage collection of past entries.
 */
ContextHistory.prototype.stop = function () {
  clearInterval(this.clearOldContextsInterval)
}
ContextHistory.prototype.clearOldContexts = function () {
  var oldTimeThreshold = relativeNow() - this.expireDelay
  while (
    this.entries.length > 0 &&
    this.entries[this.entries.length - 1].endTime < oldTimeThreshold
  ) {
    this.entries.pop()
  }
}
