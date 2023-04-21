import { ONE_MINUTE, setTimeout } from '@cloudcare/browser-core'
import { trackEventCounts } from '../../trackEventCounts'

// Some events are not being counted as they transcend views. To reduce the occurrence;
// an arbitrary delay is added for stopping event counting after the view ends.
//
// Ideally, we would not stop and keep counting events until the end of the session.
// But this might have a small performance impact if there are many many views:
// we would need to go through each event to see if the related view matches.
// So let's have a fairly short delay to avoid impacting performances too much.
//
// In the future, we could have views stored in a data structure similar to ContextHistory. Whenever
// a child event is collected, we could look into this history to find the matching view and
// increase the associated and increase its counter. Having a centralized data structure for it
// would allow us to look for views more efficiently.
//
// For now, having a small cleanup delay will already improve the situation in most cases.

export var KEEP_TRACKING_EVENT_COUNTS_AFTER_VIEW_DELAY = 5 * ONE_MINUTE

export function trackViewEventCounts(lifeCycle, viewId, onChange) {
  var _trackEventCounts = trackEventCounts({
    lifeCycle: lifeCycle,
    isChildEvent: function (event) {
      return event.view.id === viewId
    },
    onChange: onChange
  })
  return {
    scheduleStop: function () {
      setTimeout(
        _trackEventCounts.stop,
        KEEP_TRACKING_EVENT_COUNTS_AFTER_VIEW_DELAY
      )
    },
    eventCounts: _trackEventCounts.eventCounts
  }
}
