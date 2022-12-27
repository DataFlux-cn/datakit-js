import {
  toServerDuration,
  extend,
  extend2Lev,
  ActionType,
  RumEventType,
  LifeCycleEventType,
  UUID,
  noop
} from '@cloudcare/browser-core'
import { trackClickActions } from './trackClickActions'
export function startActionCollection(
  lifeCycle,
  domMutationObservable,
  configuration,
  foregroundContexts
) {
  lifeCycle.subscribe(
    LifeCycleEventType.AUTO_ACTION_COMPLETED,
    function (action) {
      lifeCycle.notify(
        LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
        processAction(action, foregroundContexts)
      )
    }
  )

  var actionContexts = { findActionId: noop }
  if (configuration.trackInteractions) {
    actionContexts = trackClickActions(
      lifeCycle,
      domMutationObservable,
      configuration
    ).actionContexts
  }
  return {
    actionContexts: actionContexts,
    addAction: function (action, savedCommonContext) {
      lifeCycle.notify(
        LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
        extend(
          { savedCommonContext: savedCommonContext },
          processAction(action, foregroundContexts)
        )
      )
    }
  }
}

function processAction(action, foregroundContexts) {
  var autoActionProperties = isAutoAction(action)
    ? {
        action: {
          error: {
            count: action.counts.errorCount
          },
          id: action.id,
          loadingTime: toServerDuration(action.duration),
          frustration: {
            type: action.frustrationTypes
          },
          long_task: {
            count: action.counts.longTaskCount
          },
          resource: {
            count: action.counts.resourceCount
          }
        },
        _dd: {
          action: {
            target: action.target,
            position: action.position
          }
        }
      }
    : {
        action: {
          loadingTime: 0
        }
      }
  var customerContext = !isAutoAction(action) ? action.context : undefined
  var actionEvent = extend2Lev(
    {
      action: {
        id: UUID(),
        target: {
          name: action.name
        },
        type: action.type
      },
      date: action.startClocks.timeStamp,
      type: RumEventType.ACTION
    },
    autoActionProperties
  )
  var inForeground = foregroundContexts.isInForegroundAt(
    action.startClocks.relative
  )
  if (inForeground !== undefined) {
    actionEvent.view = { in_foreground: inForeground }
  }
  return {
    customerContext: customerContext,
    rawRumEvent: actionEvent,
    startTime: action.startClocks.relative,
    domainContext: isAutoAction(action)
      ? { event: action.event, events: action.events }
      : {}
  }
}

function isAutoAction(action) {
  return action.type !== ActionType.CUSTOM
}
