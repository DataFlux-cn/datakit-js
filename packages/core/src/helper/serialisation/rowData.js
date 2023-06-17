import { jsonStringify } from './jsonStringify'
import { isString } from '../tools'
export function escapeRowData(str) {
  if (typeof str === 'object' && str) {
    str = jsonStringify(str)
  } else if (!isString(str)) {
    return str
  }
  var reg = /[\s=,"]/g
  return String(str).replace(reg, function (word) {
    return '\\' + word
  })
}

export function escapeJsonValue(value) {
  if (isString(value)) {
    return value
  } else {
    return jsonStringify(value)
  }
}

export function escapeFieldValueStr(str) {
  return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}
export function escapeRowField(value) {
  if (typeof value === 'object' && value) {
    return escapeFieldValueStr(jsonStringify(value))
  } else if (isString(value)) {
    return escapeFieldValueStr(value)
  } else {
    return value
  }
}
