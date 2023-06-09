import { isFunction, isBoolean, some } from '../helper/tools'
var TRIM_REGIX = /^\s+|\s+$/g
var typeMap = {
  rum: '/rum',
  log: '/logging',
  sessionReplay: '/rum/replay'
}
function getEndPointUrl(url, type) {
  // type: rum, log,replay
  var subUrl = typeMap[type]
  if (!subUrl) return ''
  if (url.indexOf('/') === 0) {
    // 绝对路径这种 /xxx
    url = location.origin + trim(url)
  }
  if (url.lastIndexOf('/') === url.length - 1)
    return trim(url) + 'v1/write' + subUrl
  return trim(url) + '/v1/write' + subUrl
}

function trim(str) {
  return str.replace(TRIM_REGIX, '')
}

export function computeTransportConfiguration(initConfiguration) {
  var isIntakeUrl = function (url) {
    return false
  }
  if (
    'isIntakeUrl' in initConfiguration &&
    isFunction(initConfiguration.isIntakeUrl) &&
    isBoolean(initConfiguration.isIntakeUrl())
  ) {
    isIntakeUrl = initConfiguration.isIntakeUrl
  }
  var isServerError = function (request) {
    return false
  }
  if (
    'isServerError' in initConfiguration &&
    isFunction(initConfiguration.isServerError) &&
    isBoolean(initConfiguration.isServerError())
  ) {
    isServerError = initConfiguration.isServerError
  }
  return {
    datakitUrl: getEndPointUrl(
      initConfiguration.datakitUrl || initConfiguration.datakitOrigin,
      'rum'
    ),
    logsEndpoint: getEndPointUrl(initConfiguration.datakitOrigin, 'log'),
    sessionReplayEndPoint: getEndPointUrl(
      initConfiguration.datakitOrigin,
      'sessionReplay'
    ),
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
  if (configuration.sessionReplayEndPoint) {
    notTakeRequest.push(configuration.sessionReplayEndPoint)
  }
  // datakit 地址，log 地址，以及客户自定义过滤方法定义url
  return (
    some(notTakeRequest, function (takeUrl) {
      return url.indexOf(takeUrl) === 0
    }) || configuration.isIntakeUrl(url)
  )
}
