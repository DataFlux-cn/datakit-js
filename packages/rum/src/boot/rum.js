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
import { createDOMMutationObservable } from '../domain/domMutationObservable.js'
import { createLocationChangeObservable } from '../domain/locationChangeObservable'
import { startLongTaskCollection } from '../domain/rumEventsCollection/longTask/longTaskCollection'
import { startActionCollection } from '../domain/rumEventsCollection/actions/actionCollection'
import { startRumBatch } from '../transport/startRumBatch'
import { startRumEventBridge } from '../transport/startRumEventBridge'
import { startRumAssembly } from '../domain/assembly'
import { startDisplayContext } from '../domain/contexts/displayContext.js'
import { startInternalContext } from '../domain/contexts/internalContext'
// import { startForegroundContexts } from '../domain/contexts/foregroundContexts'
import { startUrlContexts } from '../domain/contexts/urlContexts'
import { startViewContexts } from '../domain/contexts/viewContexts'
import { buildCommonContext } from '../domain/contexts/commonContext'
import { startPageStateHistory } from '../domain/contexts/pageStateHistory'
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
  var cleanupTasks = []
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
        id: actionContexts.findActionId(),
        ids: actionContexts.findAllActionId()
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
  cleanupTasks.push(function () {
    pageExitSubscription.unsubscribe()
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
    cleanupTasks.push(function () {
      batch.stop()
    })
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
  var pageStateHistory = _startRumEventCollection.pageStateHistory
  var stopRumEventCollection = _startRumEventCollection.stop
  var addAction = _startRumEventCollection.addAction

  cleanupTasks.push(stopRumEventCollection)

  startLongTaskCollection(lifeCycle, session)
  startResourceCollection(lifeCycle, configuration, session, pageStateHistory)

  var _startViewCollection = startViewCollection(
    lifeCycle,
    configuration,
    location,
    domMutationObservable,
    locationChangeObservable,
    pageStateHistory,
    recorderApi,
    initialViewOptions
  )
  var addTiming = _startViewCollection.addTiming
  var startView = _startViewCollection.startView
  var stopViewCollection = _startViewCollection.stop
  cleanupTasks.push(stopViewCollection)

  var _startErrorCollection = startErrorCollection(
    lifeCycle,
    configuration,
    pageStateHistory
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
    getInternalContext: internalContext.get,
    stop: function () {
      cleanupTasks.forEach(function (task) {
        task()
      })
    }
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

  var pageStateHistory = startPageStateHistory()
  var _startActionCollection = startActionCollection(
    lifeCycle,
    domMutationObservable,
    configuration,
    pageStateHistory
  )
  var actionContexts = _startActionCollection.actionContexts
  var addAction = _startActionCollection.addAction

  var displayContext = startDisplayContext()
  startRumAssembly(
    configuration,
    lifeCycle,
    sessionManager,
    userSessionManager,
    viewContexts,
    urlContexts,
    actionContexts,
    displayContext,
    buildCommonContext,
    reportError
  )
  return {
    viewContexts: viewContexts,
    urlContexts: urlContexts,
    pageStateHistory: pageStateHistory,
    addAction: addAction,
    actionContexts: actionContexts,
    stop: function () {
      viewContexts.stop()
      urlContexts.stop()
      pageStateHistory.stop()
      displayContext.stop()
    }
  }
}
