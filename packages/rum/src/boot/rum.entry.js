import { defineGlobal, getGlobalObject } from '@cloudcare/browser-core'
import { startRum } from './rum'
import { makeRumPublicApi } from './rumPublicApi'
import { startRecording } from './startRecording'
import { makeRecorderApi } from './recorderApi'
var recorderApi = makeRecorderApi(startRecording)
export var datafluxRum = makeRumPublicApi(startRum, recorderApi)

defineGlobal(getGlobalObject(), 'DATAFLUX_RUM', datafluxRum)
