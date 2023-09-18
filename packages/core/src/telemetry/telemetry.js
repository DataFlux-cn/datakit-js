import { ConsoleApiName } from '../helper/display'
import {
  toStackTraceString,
  NO_ERROR_STACK_PRESENT_MESSAGE
} from '../helper/errorTools'
import { computeStackTrace } from '../tracekit'
import { Observable } from '../helper/observable'
import {
  displayIfDebugEnabled,
  startMonitorErrorCollection
} from '..//helper/monitor'
import {
  startsWith,
  assign,
  performDraw,
  timeStampNow,
  extend2Lev
} from '../helper/tools'
import { jsonStringify } from '../helper/serialisation/jsonStringify'
import { NonErrorPrefix } from '../helper/enums'
import { TelemetryStatusType, TelemetryType } from './types'

const ALLOWED_FRAME_URLS = [
  'https://static.guance.com',
  'http://localhost',
  '<anonymous>'
]

export var TelemetryService = {
  LOGS: 'browser-logs-sdk',
  RUM: 'browser-rum-sdk'
}

var telemetryConfiguration = {
  maxEventsPerPage: 0,
  sentEventCount: 0,
  telemetryEnabled: false
}

var onRawTelemetryEventCollected

export function startTelemetry(telemetryService, configuration) {
  let contextProvider
  var observable = new Observable()
  telemetryConfiguration.telemetryEnabled =
    configuration.telemetryEnabled &&
    performDraw(configuration.telemetrySampleRate)

  onRawTelemetryEventCollected = function (rawEvent) {
    if (telemetryConfiguration.telemetryEnabled) {
      var event = toTelemetryEvent(telemetryService, rawEvent)
      observable.notify(event)
    }
  }
  startMonitorErrorCollection(addTelemetryError)

  assign(telemetryConfiguration, {
    maxEventsPerPage: configuration.maxTelemetryEventsPerPage,
    sentEventCount: 0
  })

  function toTelemetryEvent(telemetryService, event) {
    return extend2Lev(
      {
        type: 'telemetry',
        date: timeStampNow(),
        service: telemetryService,
        version: __BUILD_ENV__SDK_VERSION__,
        source: 'browser',
        telemetry: event // https://github.com/microsoft/TypeScript/issues/48457
      },
      contextProvider !== undefined ? contextProvider() : {}
    )
  }

  return {
    setContextProvider: function (provider) {
      contextProvider = provider
    },
    observable: observable,
    enabled: telemetryConfiguration.telemetryEnabled
  }
}

export function resetTelemetry() {
  onRawTelemetryEventCollected = undefined
}

export function addTelemetryDebug(message, context) {
  displayIfDebugEnabled(ConsoleApiName.debug, message, context)
  addTelemetry(
    assign(
      {
        type: TelemetryType.log,
        message: message,
        status: TelemetryStatusType.debug
      },
      context
    )
  )
}

export function addTelemetryError(e, context) {
  addTelemetry(
    assign(
      {
        type: TelemetryType.log,
        status: TelemetryStatusType.error
      },
      formatError(e),
      context
    )
  )
}

export function addTelemetryConfiguration(configuration) {
  if (telemetryConfiguration.telemetryEnabled) {
    addTelemetry({
      type: TelemetryType.configuration,
      configuration: configuration
    })
  }
}

function addTelemetry(event) {
  if (
    onRawTelemetryEventCollected &&
    telemetryConfiguration.sentEventCount <
      telemetryConfiguration.maxEventsPerPage
  ) {
    telemetryConfiguration.sentEventCount += 1
    onRawTelemetryEventCollected(event)
  }
}

export function formatError(e) {
  if (e instanceof Error) {
    var stackTrace = computeStackTrace(e)
    return {
      error: {
        kind: stackTrace.name,
        stack: toStackTraceString(scrubCustomerFrames(stackTrace))
      },
      message: stackTrace.message
    }
  }
  return {
    error: {
      stack: NO_ERROR_STACK_PRESENT_MESSAGE
    },
    message: NonErrorPrefix.UNCAUGHT + ' ' + jsonStringify(e)
  }
}

export function scrubCustomerFrames(stackTrace) {
  stackTrace.stack = stackTrace.stack.filter(function (frame) {
    return (
      !frame.url ||
      ALLOWED_FRAME_URLS.some(function (allowedFrameUrl) {
        return startsWith(frame.url, allowedFrameUrl)
      })
    )
  })
  return stackTrace
}
