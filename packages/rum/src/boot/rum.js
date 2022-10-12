import { startRumSessionManager } from '../domain/rumSessionManager'
import { startCacheUsrCache } from '../domain/usr'
import { LifeCycle, LifeCycleEventType } from '@cloudcare/browser-core'
import { startPerformanceCollection } from '../domain/performanceCollection'
import { createDOMMutationObservable } from '../domain/domMutationCollection'
import { createLocationChangeObservable } from '../domain/locationChangeObservable'
import { startLongTaskCollection } from '../domain/rumEventsCollection/longTask/longTaskCollection'
import { startActionCollection } from '../domain/rumEventsCollection/actions/actionCollection'
import { startRumBatch } from '../transport/startRumBatch'
import { startRumAssembly } from '../domain/assembly'
import { startInternalContext } from '../domain/contexts/internalContext'
import { startUrlContexts } from '../domain/contexts/urlContexts'
import { startViewContexts } from '../domain/contexts/viewContexts'
import { startErrorCollection } from '../domain/rumEventsCollection/error/errorCollection'
import { startViewCollection } from '../domain/rumEventsCollection/view/viewCollection'
import { startRequestCollection } from '../domain/requestCollection'
import { startResourceCollection } from '../domain/rumEventsCollection/resource/resourceCollection'
export function startRum(configuration, getCommonContext, initialViewOptions) {
  var lifeCycle = new LifeCycle()
  
  var reportError = function(error) {
    lifeCycle.notify(LifeCycleEventType.RAW_ERROR_COLLECTED, { error: error })
  }
  startRumBatch(configuration, lifeCycle, reportError)
  var session = startRumSessionManager(configuration, lifeCycle)
  var userSession = startCacheUsrCache(configuration)
  var domMutationObservable = createDOMMutationObservable()
  var locationChangeObservable = createLocationChangeObservable(location)
  var _startRumEventCollection = startRumEventCollection(
    location,
    lifeCycle,
    configuration,
    session,
    userSession,
    locationChangeObservable,
    domMutationObservable,
    getCommonContext,
    reportError
  )
  var viewContexts = _startRumEventCollection.viewContexts
  var urlContexts = _startRumEventCollection.urlContexts
  var actionContexts = _startRumEventCollection.actionContexts
  startLongTaskCollection(lifeCycle, session)
  startResourceCollection(lifeCycle,configuration)

  var _startViewCollection = startViewCollection(
    lifeCycle,
    configuration,
    location,
    domMutationObservable,
    locationChangeObservable,
    initialViewOptions
  )
  var addTiming = _startViewCollection.addTiming
  var startView = _startViewCollection.startView
  var _startErrorCollection = startErrorCollection(lifeCycle, configuration)
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
    addAction: _startRumEventCollection.addAction,
    addError: addError,
    addTiming: addTiming,
    configuration: configuration,
    lifeCycle: lifeCycle,
    viewContexts: viewContexts,
    session: session,
    startView: startView,
    getInternalContext: internalContext.get
  }
}

export function startRumEventCollection(
  location,
  lifeCycle,
  configuration,
  sessionManager,
  userSessionManager,
  locationChangeObservable,
  domMutationObservable,
  getCommonContext,
  reportError
) {
  var viewContexts = startViewContexts(lifeCycle)
  var urlContexts = startUrlContexts(lifeCycle, locationChangeObservable, location)
  var _startActionCollection = startActionCollection(
    lifeCycle,
    domMutationObservable,
    configuration,
  )
  var actionContexts = _startActionCollection.actionContexts
  startRumAssembly(
    configuration,
    lifeCycle,
    sessionManager,
    userSessionManager,
    viewContexts,
    urlContexts,
    actionContexts,
    getCommonContext,
    reportError
  )
  return {
    viewContexts: viewContexts,
    urlContexts: urlContexts,
    addAction: _startActionCollection.addAction,
    actionContexts: actionContexts,
    stop: function() {
      viewContexts.stop()
    },
  }
}
