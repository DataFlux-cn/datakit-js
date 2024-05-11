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

export interface SiteInitConfiguration {
  /**
   *  以openway 方式上报数据令牌，从观测云控制台获取，必填
   */
  clientToken: string | undefined

  /**
   *  以 公共openway 方式上报数据地址，从观测云控制台获取，必填
   */
  site: string | undefined
}
export interface DatakitInitConfiguration {
  /** DataKit 数据上报 Origin 注释:
   * 协议（包括：//），域名（或IP地址）[和端口号]
   * 例如：
   * https://www.datakit.com；
   * http://100.20.34.3:8088。
   */
  datakitOrigin: string
}
export interface InitConfiguration {
  /**
   *  数据发送前的的拦截器
   * @param event  事件内容
   * @param context  事件额外属性
   * @returns
   */
  beforeSend?: (event: any, context?: any) => unknown | undefined
  /**
   * 数据上报采样率，100 表示全收集；0 表示不收集。默认 100
   */
  sessionSampleRate?: number | undefined
  telemetrySampleRate?: number | undefined
  silentMultipleInit?: boolean | undefined

  service?: string | undefined
  /** Web 应用当前环境，如 prod：线上环境；gray：灰度环境；pre：预发布环境；common：日常环境；local：本地环境。 */
  env?: string | undefined
  /** Web 应用的版本号。 */
  version?: string | undefined
  /** 链路数据采样百分比：100 表示全收集；0 表示不收集。 */
  tracingSampleRate?: number | undefined
  /**
   * @deprecated use usePartitionedCrossSiteSessionCookie instead
   */
  useCrossSiteSessionCookie?: boolean | undefined
  /**
   * 是否使用跨域 cookie，开启第三方 cookie 跨分区实现。默认不允许跨域，例如嵌套跨域 iframe 的情况。
   */
  usePartitionedCrossSiteSessionCookie?: boolean | undefined
  useSecureSessionCookie?: boolean | undefined
  trackSessionAcrossSubdomains?: boolean | undefined
  /**
   * 是否把公共数据存储到localstorage,默认不存储
   */
  storeContextsToLocal?: boolean | undefined
  /**
   * 数据以 application/json 的发送方式，默认text
   */
  sendContentTypeByJson?: boolean | undefined
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

export interface RumBaseInitConfiguration extends InitConfiguration {
  /**从观测云创建的应用 ID */
  applicationId: string
  /**
   * 排除一些影响 loadingtime 的指标准确性的url，具体可参考下面文档
   * https://docs.guance.com/security/page-performance/#_3
   */
  excludedActivityUrls?: MatchOption[] | undefined
  /**
     * 允许注入 trace 采集器所需 header 头部的所有请求列表。可以是请求的 origin，也可以是正则，origin: 协议（包括：//），域名（或IP地址）[和端口号]。例如：
     ["https://api.example.com", /https:\\/\\/.*\\.my-api-domain\\.com/]。
    */
  allowedTracingUrls?: Array<MatchOption | TracingOption> | undefined
  defaultPrivacyLevel?: DefaultPrivacyLevel | undefined
  /**
     * Session Replay 数据采集百分比:
100 表示全收集；0 表示不收集。
     */
  sessionReplaySampleRate?: number | undefined
  /**
   * 是否开启用户行为采集。
   */
  trackUserInteractions?: boolean | undefined
  /**
   * 指定 action 数据 name 获取方式，默认自动获取，可以指定元素特定属性名称
   */
  actionNameAttribute?: string | undefined
  trackViewsManually?: boolean | undefined
  /**
   * 配置链路追踪工具类型，如果不配置默认为 ddtrace。目前支持 ddtrace、zipkin、skywalking_v3、jaeger、zipkin_single_header、w3c_traceparent 6 种数据类型。
   */
  traceType?: TraceType
  /**
   * 是否以 128 字节的方式生成 traceID，与 traceType 对应，目前支持类型 zipkin、jaeger。
   */
  traceId128Bit?: boolean | undefined
}
export type RumInitConfiguration = RumBaseInitConfiguration &
  DatakitInitConfiguration
export type RumSiteInitConfiguration = RumBaseInitConfiguration &
  SiteInitConfiguration
