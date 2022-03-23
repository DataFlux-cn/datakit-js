export var DOM_EVENT = {
  BEFORE_UNLOAD: 'beforeunload',
  CLICK: 'click',
  KEY_DOWN: 'keydown',
  LOAD: 'load',
  POP_STATE: 'popstate',
  SCROLL: 'scroll',
  TOUCH_START: 'touchstart',
  VISIBILITY_CHANGE: 'visibilitychange',
  DOM_CONTENT_LOADED: 'DOMContentLoaded',
  POINTER_DOWN: 'pointerdown',
  POINTER_UP: 'pointerup',
  POINTER_CANCEL: 'pointercancel',
  HASH_CHANGE: 'hashchange',
  PAGE_HIDE: 'pagehide',
  MOUSE_DOWN: 'mousedown'
}
export var ResourceType = {
  DOCUMENT: 'document',
  XHR: 'xhr',
  BEACON: 'beacon',
  FETCH: 'fetch',
  CSS: 'css',
  JS: 'js',
  IMAGE: 'image',
  FONT: 'font',
  MEDIA: 'media',
  OTHER: 'other'
}

export var ActionType = {
  CLICK: 'click',
  CUSTOM: 'custom'
}
export var RumEventType = {
  ACTION: 'action',
  ERROR: 'error',
  LONG_TASK: 'long_task',
  VIEW: 'view',
  RESOURCE: 'resource',
  LOGGER: 'logger'
}

export var RequestType = {
  FETCH: ResourceType.FETCH,
  XHR: ResourceType.XHR
}

export var TraceType = {
  DDTRACE: 'ddtrace',
  ZIPKIN_MULTI_HEADER: 'zipkin',
  ZIPKIN_SINGLE_HEADER: 'zipkin_single_header',
  W3C_TRACEPARENT: 'w3c_traceparent',
  SKYWALKING_V3: 'skywalking_v3',
  JAEGER: 'jaeger',
}
export var ErrorHandling = {
  HANDLED: 'handled',
  UNHANDLED: 'unhandled',
}