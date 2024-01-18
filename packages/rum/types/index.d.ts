import type {
  RumInitConfiguration,
  InitConfiguration,
  Context,
  User
} from '@cloudcare/browser-core'
export interface InternalContext {
  application: {
    id: string
  }
  session: {
    id: string | undefined
  }
  view?: {
    id: string
    url: string
    referrer: string
    name?: string
    host: string
    path: string
    urlQuery: string
    pathGroup: string
  }
  userAction?: {
    id: string
    ids: string[]
  }
}
export declare const datafluxRum: {
  init: (initConfiguration: RumInitConfiguration) => void
  setGlobalContextProperty: (key: any, value: any) => void
  removeGlobalContextProperty: (key: any) => void
  getGlobalContext: () => Context
  setGlobalContext: (context: any) => void
  clearGlobalContext: () => void
  getInternalContext: (
    startTime?: number | undefined
  ) => InternalContext | undefined
  getInitConfiguration: () => InitConfiguration | undefined
  addAction: (name: string, context?: object | undefined) => void
  addError: (error: unknown, context?: object | undefined) => void
  addTiming: (name: string, time?: number | undefined) => void
  setUser: (newUser: User) => void
  getUser: () => Context
  setUserProperty: (key: any, property: any) => void
  removeUserProperty: (key: any) => void
  clearUser: () => void
  stopSession: () => void
  startSessionReplayRecording: () => void
  stopSessionReplayRecording: () => void
} & {
  onReady(callback: () => void): void
}
