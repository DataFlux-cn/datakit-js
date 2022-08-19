import {
  ONE_KILO_BYTE,
  ONE_SECOND,
  extend2Lev,
  isArray,
  includes,
  isFunction,
  isBoolean,
  values
} from './helper/tools'
import { getCurrentSite } from './cookie'
import { haveSameOrigin } from './helper/urlPolyfill'
import { TraceType } from './helper/enums'
var TRIM_REGIX = /^\s+|\s+$/g
export var DEFAULT_CONFIGURATION = {
  resourceSampleRate: 100,
  sampleRate: 100,
  flushTimeout: 30 * ONE_SECOND,
  maxErrorsByMinute: 3000,
  /**
   * Logs intake limit
   */
  maxBatchSize: 50,
  maxMessageSize: 256 * ONE_KILO_BYTE,
  /**
   * arbitrary value, byte precision not needed
   */
  requestErrorResponseLengthLimit: 32 * ONE_KILO_BYTE,

  /**
   * beacon payload max queue size implementation is 64kb
   * ensure that we leave room for logs, rum and potential other users
   */
  batchBytesLimit: 16 * ONE_KILO_BYTE,
  datakitUrl: '',
  logsEndpoint: '',
  traceType: TraceType.DDTRACE,
  traceId128Bit: false,
  trackInteractions: false, //是否开启交互action收集
  allowedDDTracingOrigins: [], //废弃
  allowedTracingOrigins:[], // 新增
  isServiceSampling: false, // 是否不抛弃采样是数据， 采用在服务端菜样的方式
  isJsBirdge: false,// 是否需要对webview 发送数据，需要装我们对应ios sdk
  isLineProtocolToJson: false,
  beforeSend: function (event) {},
  isServerError: function(request) {return false}  // 判断请求是否为error 请求
}
function trim(str) {
  return str.replace(TRIM_REGIX, '')
}
export function buildCookieOptions(userConfiguration) {
  var cookieOptions = {}

  cookieOptions.secure = mustUseSecureCookie(userConfiguration)
  cookieOptions.crossSite = !!userConfiguration.useCrossSiteSessionCookie

  if (!!userConfiguration.trackSessionAcrossSubdomains) {
    cookieOptions.domain = getCurrentSite()
  }

  return cookieOptions
}
function getDatakitUrl(url) {
  if (url.lastIndexOf('/') === url.length - 1) return trim(url) + 'v1/write/rum'
  return trim(url) + '/v1/write/rum'
}
function getLogsEndPoint(url) {
  if (url.lastIndexOf('/') === url.length - 1)
    return trim(url) + 'v1/write/logging'
  return trim(url) + '/v1/write/logging'
}
export function commonInit(userConfiguration, buildEnv) {
  var enableExperimentalFeatures = isArray(
    userConfiguration.enableExperimentalFeatures
  )
    ? userConfiguration.enableExperimentalFeatures
    : []
  var transportConfiguration = {
    applicationId: userConfiguration.applicationId,
    env: userConfiguration.env || '',
    version: userConfiguration.version || '',
    service: userConfiguration.service || 'browser',
    sdkVersion: buildEnv.sdkVersion,
    sdkName: buildEnv.sdkName,
    datakitUrl: getDatakitUrl(
      userConfiguration.datakitUrl || userConfiguration.datakitOrigin
    ),
    logsEndpoint: getLogsEndPoint(userConfiguration.datakitOrigin),
    isEnabled: function(feature) {return includes(enableExperimentalFeatures, feature)},
    cookieOptions: buildCookieOptions(userConfiguration)
  }
  if ('isJsBirdge' in userConfiguration) {
    transportConfiguration.isJsBirdge = userConfiguration.isJsBirdge
  }
  if ('isLineProtocolToJson' in userConfiguration) {
    transportConfiguration.isLineProtocolToJson = userConfiguration.isLineProtocolToJson
  }
  if ('allowedDDTracingOrigins' in userConfiguration) {
    transportConfiguration.allowedTracingOrigins =
      userConfiguration.allowedDDTracingOrigins
  }
  if ('allowedTracingOrigins' in userConfiguration) {
    transportConfiguration.allowedTracingOrigins = userConfiguration.allowedTracingOrigins
  }
  if ('sampleRate' in userConfiguration) {
    transportConfiguration.sampleRate = userConfiguration.sampleRate
  }

  if ('resourceSampleRate' in userConfiguration) {
    transportConfiguration.resourceSampleRate =
      userConfiguration.resourceSampleRate
  }

  if ('trackInteractions' in userConfiguration) {
    transportConfiguration.trackInteractions = !!userConfiguration.trackInteractions
  }
  if ('isServerError' in userConfiguration && isFunction(userConfiguration.isServerError) && isBoolean(userConfiguration.isServerError())) {
    transportConfiguration.isServerError = userConfiguration.isServerError
  }
  if ('traceId128Bit' in userConfiguration) {
    transportConfiguration.traceId128Bit = !!userConfiguration.traceId128Bit
  }
  if ('traceType' in userConfiguration && hasTraceType(userConfiguration.traceType)) {
    transportConfiguration.traceType = userConfiguration.traceType
  }
  if ('isServiceSampling' in userConfiguration && isBoolean(userConfiguration.isServiceSampling)) {
    transportConfiguration.isServiceSampling = userConfiguration.isServiceSampling
  }
  return extend2Lev({}, DEFAULT_CONFIGURATION, transportConfiguration)
}
function hasTraceType(traceType) {
  if (traceType && values(TraceType).indexOf(traceType) > -1) return true
  return false
}
function mustUseSecureCookie(userConfiguration) {
  return (
    !!userConfiguration.useSecureSessionCookie ||
    !!userConfiguration.useCrossSiteSessionCookie
  )
}

export function isIntakeRequest(url, configuration) {
  // return haveSameOrigin(url, configuration.datakitUrl)
  var notTakeRequest = [configuration.datakitUrl]
  if (configuration.logsEndpoint) {
    notTakeRequest.push(configuration.logsEndpoint)
  }
  var isIntake = false
  for(var _url of notTakeRequest) {
    if (url.indexOf(_url) === 0) {
      isIntake = true
      break;
    }
  }
  return isIntake
}
