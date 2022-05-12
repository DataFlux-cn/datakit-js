import {
  toServerDuration,
  extend,
  extend2Lev,
  preferredTimeStamp,
  ActionType,
  RumEventType,
  LifeCycleEventType
} from '@cloudcare/browser-core'
import { trackActions } from './trackActions'

export function startActionCollection(lifeCycle, configuration) {
  lifeCycle.subscribe(
    LifeCycleEventType.AUTO_ACTION_COMPLETED,
    function (action) {
      lifeCycle.notify(
        LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
        processAction(action)
      )
    }
  )
  if (configuration.trackInteractions) {
    trackActions(lifeCycle)
  }

  return {
    addAction: function (action, savedCommonContext) {
      lifeCycle.notify(
        LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
        extend(
          { savedCommonContext: savedCommonContext },
          processAction(action)
        )
      )
    }
  }
}

function processAction(action) {
  var autoActionProperties = isAutoAction(action)
    ? {
        action: {
          error: {
            count: action.counts.errorCount
          },
          id: action.id,
          loadingTime: toServerDuration(action.duration),
          long_task: {
            count: action.counts.longTaskCount
          },
          resource: {
            count: action.counts.resourceCount
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
        target: {
          name: action.name
        },
        type: action.type
      },
      date: preferredTimeStamp(action.startClocks),
      type: RumEventType.ACTION
    },
    autoActionProperties
  )
  return {
    customerContext: customerContext,
    rawRumEvent: actionEvent,
    startTime: action.startClocks.relative
  }
}

function isAutoAction(action) {
  return action.type !== ActionType.CUSTOM
}
