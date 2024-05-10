import type {
  InitConfiguration,
  ConsoleApiName,
  RawReportType
} from '@cloudcare/browser-core'
export interface LogsInitConfiguration extends InitConfiguration {
  beforeSend?: ((event: any) => boolean) | undefined
  forwardErrorsToLogs?: boolean | undefined
  forwardConsoleLogs?: ConsoleApiName[] | 'all' | undefined
  forwardReports?: RawReportType[] | 'all' | undefined
  requestErrorResponseLengthLimit?: number
}
