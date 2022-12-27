import { display } from '../helper/display'
import {
  addEventListener,
  noop,
  values,
  findByPath,
  escapeRowData,
  each,
  isNumber,
  isArray,
  extend,
  isString,
  toServerDuration,
  isBoolean,
  isEmptyObject,
  isObject,
  escapeJsonValue,
  escapeRowField
} from '../helper/tools'
import { commonTags, dataMap } from '../dataMap'
import { DOM_EVENT, RumEventType } from '../helper/enums'
// https://en.wikipedia.org/wiki/UTF-8
// eslint-disable-next-line no-control-regex
var HAS_MULTI_BYTES_CHARACTERS = /[^\u0000-\u007F]/
var CUSTOM_KEYS = 'custom_keys'
export var processedMessageByDataMap = function (message) {
  if (!message || !message.type)
    return {
      rowStr: '',
      rowData: undefined
    }

  var rowData = { tags: {}, fields: {} }
  var hasFileds = false
  var rowStr = ''
  each(dataMap, function (value, key) {
    if (value.type === message.type) {
      rowStr += key + ','
      rowData.measurement = key
      var tagsStr = []
      var tags = extend({}, commonTags, value.tags)
      var filterFileds = ['date', 'type', CUSTOM_KEYS] // 已经在datamap中定义过的fields和tags
      each(tags, function (value_path, _key) {
        var _value = findByPath(message, value_path)
        filterFileds.push(_key)
        if (_value || isNumber(_value)) {
          rowData.tags[_key] = escapeJsonValue(_value)
          tagsStr.push(escapeRowData(_key) + '=' + escapeRowData(_value))
        }
      })

      var fieldsStr = []
      each(value.fields, function (_value, _key) {
        if (isArray(_value) && _value.length === 2) {
          var type = _value[0],
            value_path = _value[1]
          var _valueData = findByPath(message, value_path)
          filterFileds.push(_key)
          if (_valueData || isNumber(_valueData)) {
            rowData.fields[_key] = _valueData // 这里不需要转译
            // _valueData =
            //   type === 'string'
            //     ? '"' +
            //       _valueData.replace(/[\\]*"/g, '"').replace(/"/g, '\\"') +
            //       '"'
            //     : escapeRowData(_valueData)
            fieldsStr.push(
              escapeRowData(_key) + '=' + escapeRowField(_valueData)
            )
          }
        } else if (isString(_value)) {
          var _valueData = findByPath(message, _value)
          filterFileds.push(_key)
          if (_valueData || isNumber(_valueData)) {
            rowData.fields[_key] = _valueData // 这里不需要转译
            fieldsStr.push(
              escapeRowData(_key) + '=' + escapeRowField(_valueData)
            )
          }
        }
      })
      if (
        message.tags &&
        isObject(message.tags) &&
        !isEmptyObject(message.tags)
      ) {
        // 自定义tag， 存储成field
        var _tagKeys = []
        each(message.tags, function (_value, _key) {
          // 如果和之前tag重名，则舍弃
          if (filterFileds.indexOf(_key) > -1) return
          filterFileds.push(_key)
          if (_value || isNumber(_value)) {
            _tagKeys.push(_key)
            rowData.fields[_key] = _value // 这里不需要转译
            fieldsStr.push(escapeRowData(_key) + '=' + escapeRowField(_value))
          }
        })
        if (_tagKeys.length) {
          rowData.fields[CUSTOM_KEYS] = escapeRowField(_tagKeys)
          fieldsStr.push(
            escapeRowData(CUSTOM_KEYS) + '=' + escapeRowField(_tagKeys)
          )
        }
      }
      if (message.type === RumEventType.LOGGER) {
        // 这里处理日志类型数据自定义字段
        each(message, function (value, key) {
          if (
            filterFileds.indexOf(key) === -1 &&
            (isNumber(value) || isString(value) || isBoolean(value))
          ) {
            rowData.fields[key] = value // 这里不需要转译
            fieldsStr.push(escapeRowData(key) + '=' + escapeRowField(value))
          }
        })
      }
      if (tagsStr.length) {
        rowStr += tagsStr.join(',')
      }
      if (fieldsStr.length) {
        rowStr += ' '
        rowStr += fieldsStr.join(',')
        hasFileds = true
      }
      rowStr = rowStr + ' ' + message.date
      rowData.time = toServerDuration(message.date) // 这里不需要转译
    }
  })
  return {
    rowStr: hasFileds ? rowStr : '',
    rowData: hasFileds ? rowData : undefined
  }
}
var batch = function (
  request,
  batchMessagesLimit,
  batchBytesLimit,
  messageBytesLimit,
  flushTimeout,
  pageExitObservable
) {
  this.pushOnlyBuffer = []
  this.upsertBuffer = {}
  this.bufferBytesCount = 0
  this.bufferMessagesCount = 0
  this.request = request
  this.batchMessagesLimit = batchMessagesLimit
  this.batchBytesLimit = batchBytesLimit
  this.messageBytesLimit = messageBytesLimit
  this.flushTimeout = flushTimeout
  var _this = this
  pageExitObservable.subscribe(function () {
    _this.flush(_this.request.sendOnExit)
  })
  this.flushPeriodically()
}
batch.prototype.add = function (message) {
  this.addOrUpdate(message)
}
batch.prototype.upsert = function (message, key) {
  this.addOrUpdate(message, key)
}
batch.prototype.flush = function (sendFn) {
  if (typeof sendFn !== 'function') {
    sendFn = this.request.send
  }
  if (this.bufferMessagesCount !== 0) {
    var messages = this.pushOnlyBuffer.concat(values(this.upsertBuffer))
    var bytesCount = this.bufferBytesCount
    this.pushOnlyBuffer = []
    this.upsertBuffer = {}
    this.bufferBytesCount = 0
    this.bufferMessagesCount = 0
    if (messages.length > 0) {
      sendFn({ data: messages.join('\n'), bytesCount: bytesCount })
    }
  }
}
batch.prototype.flushOnExit = function () {
  this.flush(this.request.sendOnExit)
}
batch.prototype.computeBytesCount = function (candidate) {
  // Accurate bytes count computations can degrade performances when there is a lot of events to process
  if (!HAS_MULTI_BYTES_CHARACTERS.test(candidate)) {
    return candidate.length
  }

  if (window.TextEncoder !== undefined) {
    return new TextEncoder().encode(candidate).length
  }

  return new Blob([candidate]).size
}
batch.prototype.addOrUpdate = function (message, key) {
  var _process = this.process(message)
  var processedMessage = _process.processedMessage
  var messageBytesCount = _process.messageBytesCount
  if (messageBytesCount >= this.messageBytesLimit) {
    display.warn(
      'Discarded a message whose size was bigger than the maximum allowed size ' +
        this.messageBytesLimit +
        'KB.'
    )
    return
  }
  if (this.hasMessageFor(key)) {
    this.remove(key)
  }
  if (this.willReachedBytesLimitWith(messageBytesCount)) {
    this.flush()
  }

  this.push(processedMessage, messageBytesCount, key)
  if (this.isFull()) {
    this.flush()
  }
}
batch.prototype.process = function (message) {
  var processedMessage = processedMessageByDataMap(message).rowStr
  var messageBytesCount = this.computeBytesCount(processedMessage)
  return {
    processedMessage: processedMessage,
    messageBytesCount: messageBytesCount
  }
}

batch.prototype.push = function (processedMessage, messageBytesCount, key) {
  if (this.bufferMessagesCount > 0) {
    // \n separator at serialization
    this.bufferBytesCount += 1
  }
  if (key !== undefined) {
    this.upsertBuffer[key] = processedMessage
  } else {
    this.pushOnlyBuffer.push(processedMessage)
  }
  this.bufferBytesCount += messageBytesCount
  this.bufferMessagesCount += 1
}

batch.prototype.remove = function (key) {
  var removedMessage = this.upsertBuffer[key]
  delete this.upsertBuffer[key]
  var messageBytesCount = this.computeBytesCount(removedMessage)
  this.bufferBytesCount -= messageBytesCount
  this.bufferMessagesCount -= 1
  if (this.bufferMessagesCount > 0) {
    this.bufferBytesCount -= 1
  }
}

batch.prototype.hasMessageFor = function (key) {
  return key !== undefined && this.upsertBuffer[key] !== undefined
}

batch.prototype.willReachedBytesLimitWith = function (messageBytesCount) {
  // byte of the separator at the end of the message
  return this.bufferBytesCount + messageBytesCount + 1 >= this.batchBytesLimit
}

batch.prototype.isFull = function () {
  return (
    this.bufferMessagesCount === this.batchMessagesLimit ||
    this.bufferBytesCount >= this.batchBytesLimit
  )
}

batch.prototype.flushPeriodically = function () {
  var _this = this
  setTimeout(function () {
    _this.flush()
    _this.flushPeriodically()
  }, this.flushTimeout)
}

export var Batch = batch
