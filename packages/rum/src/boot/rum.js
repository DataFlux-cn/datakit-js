import {
  startRumSessionManager,
  startRumSessionManagerStub
} from '../domain/rumSessionManager'
import { startCacheUsrCache } from '../domain/usr'
import {
  LifeCycle,
  LifeCycleEventType,
  createPageExitObservable,
  canUseEventBridge,
  startTelemetry,
  getEventBridge,
  TelemetryService
} from '@cloudcare/browser-core'
import { startPerformanceCollection } from '../domain/performanceCollection'
import { createDOMMutationObservable } from '../domain/domMutationCollection'
import { createLocationChangeObservable } from '../domain/locationChangeObservable'
import { startLongTaskCollection } from '../domain/rumEventsCollection/longTask/longTaskCollection'
import { startActionCollection } from '../domain/rumEventsCollection/actions/actionCollection'
import { startRumBatch } from '../transport/startRumBatch'
import { startRumEventBridge } from '../transport/startRumEventBridge'
import { startRumAssembly } from '../domain/assembly'
import { startInternalContext } from '../domain/contexts/internalContext'
import { startForegroundContexts } from '../domain/contexts/foregroundContexts'
import { startUrlContexts } from '../domain/contexts/urlContexts'
import { startViewContexts } from '../domain/contexts/viewContexts'
import { buildCommonContext } from '../domain/contexts/commonContext'
import { startErrorCollection } from '../domain/rumEventsCollection/error/errorCollection'
import { startViewCollection } from '../domain/rumEventsCollection/view/viewCollection'
import { startRequestCollection } from '../domain/requestCollection'
import { startResourceCollection } from '../domain/rumEventsCollection/resource/resourceCollection'
export function startRum(
  configuration,
  recorderApi,
  globalContextManager,
  userContextManager,
  initialViewOptions
) {
  var lifeCycle = new LifeCycle()
  var telemetry = startRumTelemetry(configuration)
  telemetry.setContextProvider(function () {
    return {
      application: {
        id: configuration.applicationId
      },
      session: {
        id: session.findTrackedSession() && session.findTrackedSession().id
      },
      view: {
        id: viewContexts.findView() && viewContexts.findView().id
      },
      action: {
        id: actionContexts.findActionId()
      }
    }
  })
  var reportError = function (error) {
    lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, { error: error })
  }
  var pageExitObservable = createPageExitObservable()
  pageExitObservable.subscribe(function (event) {
    lifeCycle.notify(LifeCycleEventType.PAGE_EXITED, event)
  })

  var session = !canUseEventBridge()
    ? startRumSessionManager(configuration, lifeCycle)
    : startRumSessionManagerStub()
  if (!canUseEventBridge()) {
    var batch = startRumBatch(
      configuration,
      lifeCycle,
      telemetry.observable,
      reportError,
      pageExitObservable,
      session.expireObservable
    )
  } else {
    startRumEventBridge(lifeCycle)
  }

  var userSession = startCacheUsrCache(configuration)
  var domMutationObservable = createDOMMutationObservable()
  var locationChangeObservable = createLocationChangeObservable(location)
  var _startRumEventCollection = startRumEventCollection(
    lifeCycle,
    configuration,
    location,
    session,
    userSession,
    locationChangeObservable,
    domMutationObservable,
    function () {
      return buildCommonContext(
        globalContextManager,
        userContextManager,
        recorderApi
      )
    },
    reportError
  )
  var viewContexts = _startRumEventCollection.viewContexts
  var urlContexts = _startRumEventCollection.urlContexts
  var actionContexts = _startRumEventCollection.actionContexts
  var foregroundContexts = _startRumEventCollection.foregroundContexts
  var addAction = _startRumEventCollection.addAction
  startLongTaskCollection(lifeCycle, session)
  startResourceCollection(lifeCycle, configuration)

  var _startViewCollection = startViewCollection(
    lifeCycle,
    configuration,
    location,
    domMutationObservable,
    locationChangeObservable,
    foregroundContexts,
    recorderApi,
    initialViewOptions
  )
  var addTiming = _startViewCollection.addTiming
  var startView = _startViewCollection.startView
  var _startErrorCollection = startErrorCollection(
    lifeCycle,
    foregroundContexts
  )
  var addError = _startErrorCollection.addError
  startRequestCollection(lifeCycle, configuration, session)
  startPerformanceCollection(lifeCycle, configuration)
  var internalContext = startInternalContext(
    configuration.applicationId,
    session,
    viewContexts,
    actionContexts,
    urlContexts
  )
  return {
    addAction: addAction,
    addError: addError,
    addTiming: addTiming,
    configuration: configuration,
    lifeCycle: lifeCycle,
    viewContexts: viewContexts,
    session: session,
    startView: startView,
    stopSession: function () {
      session.expire()
    },
    getInternalContext: internalContext.get
  }
}
function startRumTelemetry(configuration) {
  const telemetry = startTelemetry(TelemetryService.RUM, configuration)
  //   if (canUseEventBridge()) {
  //     const bridge = getEventBridge()
  //     telemetry.observable.subscribe((event) =>
  //       bridge.send('internal_telemetry', event)
  //     )
  //   }
  return telemetry
}

export function startRumEventCollection(
  lifeCycle,
  configuration,
  location,
  sessionManager,
  userSessionManager,
  locationChangeObservable,
  domMutationObservable,
  buildCommonContext,
  reportError
) {
  var viewContexts = startViewContexts(lifeCycle)
  var urlContexts = startUrlContexts(
    lifeCycle,
    locationChangeObservable,
    location
  )
  var foregroundContexts = startForegroundContexts()
  var _startActionCollection = startActionCollection(
    lifeCycle,
    domMutationObservable,
    configuration,
    foregroundContexts
  )
  var actionContexts = _startActionCollection.actionContexts
  var addAction = _startActionCollection.addAction
  startRumAssembly(
    configuration,
    lifeCycle,
    sessionManager,
    userSessionManager,
    viewContexts,
    urlContexts,
    actionContexts,
    buildCommonContext,
    reportError
  )
  return {
    viewContexts: viewContexts,
    urlContexts: urlContexts,
    foregroundContexts: foregroundContexts,
    addAction: addAction,
    actionContexts: actionContexts,
    stop: function () {
      viewContexts.stop()
      foregroundContexts.stop()
    }
  }
}
