import { getZoneJsOriginalValue } from './getZoneJsOriginalValue'
import { getGlobalObject } from '../init'

export function setTimeout(callback, delay) {
  return getZoneJsOriginalValue(getGlobalObject(), 'setTimeout')(
    callback,
    delay
  )
}

export function clearTimeout(timeoutId) {
  getZoneJsOriginalValue(getGlobalObject(), 'clearTimeout')(timeoutId)
}

export function setInterval(callback, delay) {
  return getZoneJsOriginalValue(window, 'setInterval')(callback, delay)
}

export function clearInterval(timeoutId) {
  getZoneJsOriginalValue(window, 'clearInterval')(timeoutId)
}
