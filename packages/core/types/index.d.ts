export interface Context {
  [x: string]: ContextValue
}
export interface User {
  id?: string | undefined
  email?: string | undefined
  name?: string | undefined
  [key: string]: unknown
}
export declare const ConsoleApiName: {
  readonly log: 'log'
  readonly debug: 'debug'
  readonly info: 'info'
  readonly warn: 'warn'
  readonly error: 'error'
}
export type ConsoleApiName = typeof ConsoleApiName

export declare const RawReportType: {
  readonly intervention: 'intervention'
  readonly deprecation: 'deprecation'
  readonly cspViolation: 'csp_violation'
}
export type RawReportType = (typeof RawReportType)[keyof typeof RawReportType]
export interface InitConfiguration {
  clientToken?: string | undefined
  beforeSend?: (event: any, context?: any) => unknown | undefined
  sessionSampleRate?: number | undefined
  telemetrySampleRate?: number | undefined
  silentMultipleInit?: boolean | undefined
  site?: string | undefined
  datakitOrigin: string
  service?: string | undefined
  env?: string | undefined
  version?: string | undefined
  tracingSampleRate: number | undefined
  /**
   * @deprecated use usePartitionedCrossSiteSessionCookie instead
   */
  useCrossSiteSessionCookie?: boolean | undefined
  useSecureSessionCookie?: boolean | undefined
  trackSessionAcrossSubdomains?: boolean | undefined
  storeContextsToLocal: boolean | undefined
  sendContentTypeByJson: boolean | undefined
}
export enum TraceType {
  DDTRACE = 'ddtrace',
  ZIPKIN_MULTI_HEADER = 'zipkin',
  ZIPKIN_SINGLE_HEADER = 'zipkin_single_header',
  W3C_TRACEPARENT = 'w3c_traceparent',
  W3C_TRACEPARENT_64 = 'w3c_traceparent_64bit',
  SKYWALKING_V3 = 'skywalking_v3',
  JAEGER = 'jaeger'
}
export declare const DefaultPrivacyLevel: {
  readonly ALLOW: 'allow'
  readonly MASK: 'mask'
  readonly MASK_USER_INPUT: 'mask-user-input'
}
export type DefaultPrivacyLevel =
  (typeof DefaultPrivacyLevel)[keyof typeof DefaultPrivacyLevel]

export type MatchOption = string | RegExp | ((value: string) => boolean)
export type TracingOption = {
  match: MatchOption
  traceType: TraceType
}

export declare function isMatchOption(item: unknown): item is MatchOption
/**
 * Returns true if value can be matched by at least one of the provided MatchOptions.
 * When comparing strings, setting useStartsWith to true will compare the value with the start of
 * the option, instead of requiring an exact match.
 */
export declare function matchList(
  list: MatchOption[],
  value: string,
  useStartsWith?: boolean
): boolean

export interface RumInitConfiguration extends InitConfiguration {
  applicationId: string
  excludedActivityUrls?: MatchOption[] | undefined
  allowedTracingUrls?: Array<MatchOption | TracingOption> | undefined
  defaultPrivacyLevel?: DefaultPrivacyLevel | undefined
  sessionReplaySampleRate?: number | undefined
  trackUserInteractions?: boolean | undefined
  actionNameAttribute?: string | undefined
  trackViewsManually?: boolean | undefined
  traceType: TraceType
  traceId128Bit: boolean | undefined
}
