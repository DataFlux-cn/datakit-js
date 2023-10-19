import { display } from '../helper/display'
import {
  values,
  findByPath,
  each,
  isNumber,
  isArray,
  extend,
  isString,
  isEmptyObject,
  isObject
} from '../helper/tools'
import {
  escapeJsonValue,
  escapeRowField,
  escapeRowData
} from '../helper/serialisation/rowData'
import { commonTags, dataMap, commonFields } from '../dataMap'
import { RumEventType } from '../helper/enums'
import { computeBytesCount } from '../helper/byteUtils'
import { isPageExitReason } from '../browser/pageExitObservable'
import { jsonStringify } from '../helper/serialisation/jsonStringify'
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
          rowData.tags[_key] = escapeJsonValue(_value, true)
          tagsStr.push(escapeRowData(_key) + '=' + escapeRowData(_value))
        }
      })

      var fieldsStr = []
      var fields = extend({}, commonFields, value.fields)
      each(fields, function (_value, _key) {
        if (isArray(_value) && _value.length === 2) {
          var value_path = _value[1]
          var _valueData = findByPath(message, value_path)
          filterFileds.push(_key)
          if (_valueData !== undefined && _valueData !== null) {
            rowData.fields[_key] = escapeJsonValue(_valueData) // 这里不需要转译
            fieldsStr.push(
              escapeRowData(_key) + '=' + escapeRowField(_valueData)
            )
          }
        } else if (isString(_value)) {
          var _valueData = findByPath(message, _value)
          filterFileds.push(_key)
          if (_valueData !== undefined && _valueData !== null) {
            rowData.fields[_key] = escapeJsonValue(_valueData) // 这里不需要转译
            fieldsStr.push(
              escapeRowData(_key) + '=' + escapeRowField(_valueData)
            )
          }
        }
      })
      if (
        message.context &&
        isObject(message.context) &&
        !isEmptyObject(message.context)
      ) {
        // 自定义tag， 存储成field
        var _tagKeys = []
        each(message.context, function (_value, _key) {
          // 如果和之前tag重名，则舍弃
          if (filterFileds.indexOf(_key) > -1) return
          filterFileds.push(_key)
          if (_value !== undefined && _value !== null) {
            _tagKeys.push(_key)
            rowData.fields[_key] = escapeJsonValue(_value) // 这里不需要转译
            fieldsStr.push(escapeRowData(_key) + '=' + escapeRowField(_value))
          }
        })
        if (_tagKeys.length) {
          rowData.fields[CUSTOM_KEYS] = escapeJsonValue(_tagKeys)
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
            value !== undefined &&
            value !== null
          ) {
            rowData.fields[key] = escapeJsonValue(value) // 这里不需要转译
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
      rowData.time = message.date // 这里不需要转译
    }
  })
  return {
    rowStr: hasFileds ? rowStr : '',
    rowData: hasFileds ? rowData : undefined
  }
}
var batch = function (
  request,
  flushController,
  messageBytesLimit,
  sendContentTypeByJson
) {
  this.pushOnlyBuffer = []
  this.upsertBuffer = {}
  this.request = request
  this.flushController = flushController
  this.messageBytesLimit = messageBytesLimit
  this.sendContentTypeByJson = sendContentTypeByJson
  var _this = this
  this.flushController.flushObservable.subscribe(function (event) {
    _this.flush(event)
  })
}
batch.prototype.add = function (message) {
  this.addOrUpdate(message)
}
batch.prototype.upsert = function (message, key) {
  this.addOrUpdate(message, key)
}
batch.prototype.flush = function (event) {
  var messages = this.pushOnlyBuffer.concat(values(this.upsertBuffer))
  this.pushOnlyBuffer = []
  this.upsertBuffer = {}
  if (messages.length > 0) {
    var payloadData = ''
    if (this.sendContentTypeByJson) {
      payloadData = '[' + messages.join(',') + ']'
    } else {
      payloadData = messages.join('\n')
    }
    var payload = {
      data: payloadData,
      bytesCount: event.bytesCount,
      flushReason: event.reason
    }
    if (isPageExitReason(event.reason)) {
      this.request.sendOnExit(payload)
    } else {
      this.request.send(payload)
    }
  }
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
  this.push(processedMessage, messageBytesCount, key)
}
batch.prototype.process = function (message) {
  var processedMessage = ''
  if (this.sendContentTypeByJson) {
    processedMessage = jsonStringify(processedMessageByDataMap(message).rowData)
  } else {
    processedMessage = processedMessageByDataMap(message).rowStr
  }
  var messageBytesCount = computeBytesCount(processedMessage)
  return {
    processedMessage: processedMessage,
    messageBytesCount: messageBytesCount
  }
}

batch.prototype.push = function (processedMessage, messageBytesCount, key) {
  var separatorBytesCount = this.flushController.getMessagesCount() > 0 ? 1 : 0
  this.flushController.notifyBeforeAddMessage(
    messageBytesCount + separatorBytesCount
  )
  if (key !== undefined) {
    this.upsertBuffer[key] = processedMessage
  } else {
    this.pushOnlyBuffer.push(processedMessage)
  }
  this.flushController.notifyAfterAddMessage()
}

batch.prototype.remove = function (key) {
  var removedMessage = this.upsertBuffer[key]
  delete this.upsertBuffer[key]
  var messageBytesCount = computeBytesCount(removedMessage)
  // If there are other messages, a '\n' will be added at serialization
  var separatorBytesCount = this.flushController.getMessagesCount() > 1 ? 1 : 0
  this.flushController.notifyAfterRemoveMessage(
    messageBytesCount + separatorBytesCount
  )
}

batch.prototype.hasMessageFor = function (key) {
  return key !== undefined && this.upsertBuffer[key] !== undefined
}
export var Batch = batch
