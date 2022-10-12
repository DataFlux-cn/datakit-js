
export var ConsoleApiName = {
  log: 'log',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
}
export var display = function(api) {
  var args = [].slice.call(arguments, 1)
  if (!Object.prototype.hasOwnProperty.call(ConsoleApiName, api)) {
    api = ConsoleApiName.log
  }
  display[api].apply(display,args)
}

display.debug = console.debug.bind(console)
display.log = console.log.bind(console)
display.info = console.info.bind(console)
display.warn = console.warn.bind(console)
display.error = console.error.bind(console)
