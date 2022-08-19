import {
  areCookiesAuthorized,
  commonInit,
  createErrorFilter,
  extend,
  startAutomaticErrorCollection,
  Observable,
  limitModification,
  Batch,
  HttpRequest,
  urlParse,
  getStatusGroup,
  deviceInfo,
  RumEventType,
  replaceNumberCharByPath,
  withSnakeCaseKeys,
  extend2Lev
} from '@cloudcare/browser-core'
import { StatusType } from '../domain/logger'
import { startLoggerSession } from '../domain/loggerSession'
import { buildEnv } from './buildEnv'

var FIELDS_WITH_SENSITIVE_DATA = [
  'view.url',
  'view.referrer',
  'message',
  'error.stack',
  'source.url'
]

export function startLogs(userConfiguration, errorLogger, getGlobalContext) {
  var configuration = commonInit(userConfiguration, buildEnv)
  var errorObservable =
    userConfiguration.forwardErrorsToLogs !== false
      ? startAutomaticErrorCollection(configuration)
      : new Observable()
  var session = startLoggerSession(
    configuration,
    areCookiesAuthorized(configuration.cookieOptions)
  )
  return doStartLogs(
    configuration,
    errorObservable,
    session,
    errorLogger,
    getGlobalContext
  )
}

export function doStartLogs(
  configuration,
  errorObservable,
  session,
  errorLogger,
  getGlobalContext
) {
  var assemble = buildAssemble(session, configuration, reportError)
  var batch = startLoggerBatch(configuration)

  function reportError(error) {
    var resource = error.resource
    if (resource) {
      var urlObj = urlParse(error.resource.url).getParse()
      resource = {
        method: error.resource.method,
        status: error.resource.statusCode,
        statusGroup: getStatusGroup(error.resource.statusCode),
        url: error.resource.url,
        urlHost: urlObj.Host,
        urlPath: urlObj.Path,
        urlPathGroup: replaceNumberCharByPath(urlObj.Path)
      }
    }
    errorLogger.error(
      error.message,
      extend2Lev(
        {
          date: error.startClocks.timeStamp,
          error: {
            type: error.type,
            source: error.source,
            stack: error.stack
          }
        },
        {
          resource: resource
        },
        getRUMInternalContext(error.startClocks.relative)
      )
    )
  }
  errorObservable.subscribe(reportError)

  return function (message, currentContext) {
    var contextualizedMessage = assemble(message, currentContext)
    if (contextualizedMessage) {
      batch.add(contextualizedMessage)
    }
  }
}

function startLoggerBatch(configuration) {
  var primaryBatch = createLoggerBatch(configuration.logsEndpoint)

  function createLoggerBatch(endpointUrl) {
    return new Batch(
      new HttpRequest(endpointUrl, configuration.batchBytesLimit, configuration.isLineProtocolToJson),
      configuration.maxBatchSize,
      configuration.batchBytesLimit,
      configuration.maxMessageSize,
      configuration.flushTimeout,
      configuration.isLineProtocolToJson,
    )
  }

  return {
    add: function (message) {
      primaryBatch.add(message)
    }
  }
}

export function buildAssemble(session, configuration, reportError) {
  var errorFilter = createErrorFilter(configuration, reportError)
  return function (message, currentContext) {
    if (!session.isTracked()) {
      return undefined
    }
    var contextualizedMessage = extend2Lev(
      {
        service: configuration.service || 'browser',
        session: {
          id: session.getId()
        },
        type: RumEventType.LOGGER,
        _dd: {
          sdkName: configuration.sdkName,
          sdkVersion: configuration.sdkVersion,
          env: configuration.env,
          version: configuration.version
        },
        device: deviceInfo,
        user: {
          user_id: configuration.user_id
        }
      },
      currentContext,
      getRUMInternalContext(),
      message
    )
    if (configuration.beforeSend) {
      var shouldSend = limitModification(
        contextualizedMessage,
        FIELDS_WITH_SENSITIVE_DATA,
        configuration.beforeSend
      )
      if (shouldSend === false) {
        return undefined
      }
    }
    if (
      contextualizedMessage.status === StatusType.error &&
      errorFilter.isLimitReached()
    ) {
      return undefined
    }
    return withSnakeCaseKeys(contextualizedMessage)
  }
}

export function assembleMessageContexts(
  defaultContext,
  currentContext,
  rumInternalContext,
  message
) {
  return extend(defaultContext, currentContext, rumInternalContext, message)
}

function getRUMInternalContext(startTime) {
  var rum = window.DATAFLUX_RUM
  return rum && rum.getInternalContext
    ? rum.getInternalContext(startTime)
    : undefined
}
