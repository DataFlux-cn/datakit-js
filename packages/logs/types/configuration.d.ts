import type {
  InitConfiguration,
  ConsoleApiName,
  RawReportType,
  SiteInitConfiguration,
  DatakitInitConfiguration
} from '@cloudcare/browser-core'
export interface LogsBaseInitConfiguration extends InitConfiguration {
  forwardErrorsToLogs?: boolean | undefined
  forwardConsoleLogs?: ConsoleApiName[] | 'all' | undefined
  forwardReports?: RawReportType[] | 'all' | undefined
  requestErrorResponseLengthLimit?: number
}

export type LogsSiteConfiguration = LogsBaseInitConfiguration &
  DatakitInitConfiguration

export type LogsInitConfiguration = LogsBaseInitConfiguration &
  SiteInitConfiguration
