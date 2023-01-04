import { extend2Lev, each } from './tools'

/**
 * Current limitations:
 * - field path do not support array, 'a.b.c' only
 * - modifiable fields type must be string
 */
export function limitModification(object, modifiableFieldPaths, modifier) {
  var clone = extend2Lev({}, object)
  var result = modifier(clone)
  each(modifiableFieldPaths, function (path) {
    var originalValue = get(object, path)
    var newValue = get(clone, path)
    if (typeof originalValue === 'string' && typeof newValue === 'string') {
      set(object, path, newValue)
    }
  })

  return result
}

function get(object, path) {
  var current = object
  var fields = path.split('.')
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i]
    if (!isValidObjectContaining(current, field)) {
      return
    }
    current = current[field]
  }

  return current
}

function set(object, path, value) {
  var current = object
  var fields = path.split('.')
  for (var i = 0; i < fields.length; i += 1) {
    var field = fields[i]
    if (!isValidObjectContaining(current, field)) {
      return
    }
    if (i !== fields.length - 1) {
      current = current[field]
    } else {
      current[field] = value
    }
  }
}

function isValidObjectContaining(object, field) {
  return typeof object === 'object' && object !== null && field in object
}
