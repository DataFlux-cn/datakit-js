import { elapsed, ViewLoadingType } from '@cloudcare/browser-core'
import { waitPageActivityEnd } from '../../waitPageActivityEnd'
export function trackLoadingTime(
  lifeCycle,
  domMutationObservable,
  configuration,
  loadType,
  viewStart,
  callback
) {
  var isWaitingForLoadEvent = loadType === ViewLoadingType.INITIAL_LOAD
  var isWaitingForActivityLoadingTime = true
  var loadingTimeCandidates = []

  function invokeCallbackIfAllCandidatesAreReceived() {
    if (
      !isWaitingForActivityLoadingTime &&
      !isWaitingForLoadEvent &&
      loadingTimeCandidates.length > 0
    ) {
      callback(Math.max.apply(Math, loadingTimeCandidates))
    }
  }
  function stopEndCallback() {
    if (loadingTimeCandidates.length > 0) {
      callback(Math.max.apply(Math, loadingTimeCandidates))
    }
  }
  var _waitPageActivityEnd = waitPageActivityEnd(
    lifeCycle,
    domMutationObservable,
    configuration,
    function (event) {
      if (isWaitingForActivityLoadingTime) {
        isWaitingForActivityLoadingTime = false
        if (event.hadActivity) {
          loadingTimeCandidates.push(elapsed(viewStart.timeStamp, event.end))
        }
        invokeCallbackIfAllCandidatesAreReceived()
      }
    }
  )

  var stop = _waitPageActivityEnd.stop
  return {
    setLoadEvent: function (loadEvent) {
      if (isWaitingForLoadEvent) {
        isWaitingForLoadEvent = false
        loadingTimeCandidates.push(loadEvent)
        invokeCallbackIfAllCandidatesAreReceived()
      }
    },
    stop: function () {
      stop()
      stopEndCallback()
    }
  }
}
