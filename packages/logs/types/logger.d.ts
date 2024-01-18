import type { Context } from '@cloudcare/browser-core'
export interface CommonContext {
  view: {
    referrer: string
    url: string
  }
  context: Context
  user: User
}
export interface LogsMessage {
  message: string
  status: StatusType
  context?: Context
}
export type TimeStamp = number & { t: 'Epoch time' }
export declare const StatusType: {
  readonly debug: 'debug'
  readonly error: 'error'
  readonly info: 'info'
  readonly warn: 'warn'
}
export type StatusType = (typeof StatusType)[keyof typeof StatusType]
export declare const HandlerType: {
  readonly console: 'console'
  readonly http: 'http'
  readonly silent: 'silent'
}
export type HandlerType = (typeof HandlerType)[keyof typeof HandlerType]
export declare const STATUSES: StatusType[]
export interface LoggerConfiguration {
  level?: StatusType
  handler?: HandlerType | HandlerType[]
  context?: object
}
export declare class Logger {
  private handleLogStrategy
  private handlerType
  private level
  private contextManager
  constructor(
    handleLogStrategy: (
      logsMessage: LogsMessage,
      logger: Logger,
      savedCommonContext?: CommonContext,
      savedDate?: TimeStamp
    ) => void,
    name?: string,
    handlerType?: HandlerType | HandlerType[],
    level?: StatusType,
    loggerContext?: object
  )
  log(
    message: string,
    messageContext?: object,
    status?: StatusType,
    error?: Error
  ): void
  debug(message: string, messageContext?: object, error?: Error): void
  info(message: string, messageContext?: object, error?: Error): void
  warn(message: string, messageContext?: object, error?: Error): void
  error(message: string, messageContext?: object, error?: Error): void
  setContext(context: object): void
  getContext(): Context
  addContext(key: string, value: any): void
  removeContext(key: string): void
  clearContext(): void
  setHandler(handler: HandlerType | HandlerType[]): void
  getHandler(): HandlerType | HandlerType[]
  setLevel(level: StatusType): void
  getLevel(): StatusType
}
