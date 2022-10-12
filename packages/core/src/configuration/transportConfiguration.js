import { isFunction, isBoolean, some } from '../helper/tools'
var TRIM_REGIX = /^\s+|\s+$/g
function getDatakitUrl(url) {
  if (url.lastIndexOf('/') === url.length - 1) return trim(url) + 'v1/write/rum'
  return trim(url) + '/v1/write/rum'
}
function trim(str) {
  return str.replace(TRIM_REGIX, '')
}
function getLogsEndPoint(url) {
  if (url.lastIndexOf('/') === url.length - 1)
    return trim(url) + 'v1/write/logging'
  return trim(url) + '/v1/write/logging'
}
export function computeTransportConfiguration(initConfiguration) {
  var isIntakeUrl = function(url) { return false }
  if ('isIntakeUrl' in initConfiguration && isFunction(initConfiguration.isIntakeUrl) && isBoolean(initConfiguration.isIntakeUrl())) {
    isIntakeUrl = initConfiguration.isIntakeUrl
  }
  var isServerError = function(request) { return false }
  if ('isServerError' in initConfiguration && isFunction(initConfiguration.isServerError) && isBoolean(initConfiguration.isServerError())) {
    isServerError = initConfiguration.isServerError
  }
  return {
    datakitUrl: getDatakitUrl(
      initConfiguration.datakitUrl || initConfiguration.datakitOrigin
    ),
    logsEndpoint: getLogsEndPoint(initConfiguration.datakitOrigin),
    isIntakeUrl: isIntakeUrl,
    isServerError: isServerError
  }
  
}
export function isIntakeRequest(url, configuration) {
  // return haveSameOrigin(url, configuration.datakitUrl)
  var notTakeRequest = [configuration.datakitUrl]
  if (configuration.logsEndpoint) {
    notTakeRequest.push(configuration.logsEndpoint)
  }
  // datakit 地址，log 地址，以及客户自定义过滤方法定义url
  return some(notTakeRequest, function(takeUrl) { return url.indexOf(takeUrl) === 0 }) || configuration.isIntakeUrl(url)
}
