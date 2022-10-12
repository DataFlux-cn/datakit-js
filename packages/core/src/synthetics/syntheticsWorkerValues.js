import { getCookie } from '../browser/cookie'

export const SYNTHETICS_TEST_ID_COOKIE_NAME = 'guance-synthetics-public-id'
export const SYNTHETICS_RESULT_ID_COOKIE_NAME = 'guance-synthetics-result-id'
export const SYNTHETICS_INJECTS_RUM_COOKIE_NAME = 'guance-synthetics-injects-rum'


export function willSyntheticsInjectRum() {
  return Boolean(
    window._GUANCE_SYNTHETICS_INJECTS_RUM || getCookie(SYNTHETICS_INJECTS_RUM_COOKIE_NAME)
  )
}

export function getSyntheticsTestId() {
  var value = window._GUANCE_SYNTHETICS_PUBLIC_ID || getCookie(SYNTHETICS_TEST_ID_COOKIE_NAME)
  return typeof value === 'string' ? value : undefined
}

export function getSyntheticsResultId() {
  const value = window._GUANCE_SYNTHETICS_RESULT_ID || getCookie(SYNTHETICS_RESULT_ID_COOKIE_NAME)
  return typeof value === 'string' ? value : undefined
}
