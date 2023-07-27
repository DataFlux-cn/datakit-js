const packageJSON = require('../lerna.json')

let sdkVersion = packageJSON.version

module.exports = (mode) => {
  const env = {}
  if (mode === 'development') {
    env.SDK_VERSION = 'dev'
  } else {
    env.SDK_VERSION = sdkVersion
  }
  return env
}
