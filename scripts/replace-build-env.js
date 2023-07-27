const fs = require('fs')
const path = require('path')
const fsPromises = require('fs/promises')
const getEnv = require('./build-env')
const buildEnv = getEnv()
/**
 * @param filePath {string}
 * @param modifier {(content: string) => string}
 */
async function modifyFile(filePath, modifier) {
  const content = await fsPromises.readFile(filePath, { encoding: 'utf-8' })
  const modifiedContent = modifier(content)
  if (content !== modifiedContent) {
    await fsPromises.writeFile(filePath, modifiedContent)
    return true
  }
  return false
}
function runMain(mainFunction) {
  Promise.resolve()
    // The main function can be either synchronous or asynchronous, so let's wrap it in an async
    // callback that will catch both thrown errors and rejected promises
    .then(() => mainFunction())
    .catch((error) => {
      printError('\nScript exited with error:')
      printError(error)
      process.exit(1)
    })
}
const resetColor = '\x1b[0m'

function printError(...params) {
  const redColor = '\x1b[31;1m'
  console.log(redColor, ...params, resetColor)
}
function printLog(...params) {
  const greenColor = '\x1b[32;1m'
  console.log(greenColor, ...params, resetColor)
}
/**
 * Replace BuildEnv in build files
 * Usage:
 * BUILD_MODE=zzz node replace-build-env.js /path/to/build/directory
 */

runMain(async () => {
  const buildDirectory = process.argv[2]

  printLog(
    `Replacing BuildEnv in '${buildDirectory}' with:`,
    JSON.stringify(buildEnv, null, 2)
  )

  for (const path of glob.sync('**/*.js', {
    cwd: buildDirectory,
    absolute: true
  })) {
    if (await modifyFile(path, replaceBuildEnv)) {
      printLog(`Replaced BuildEnv in ${path}`)
    }
  }
})
function replaceBuildEnv(content) {
  return Object.keys(buildEnv).reduce(
    (content, key) =>
      content.replaceAll(
        `__BUILD_ENV__${key}__`,
        JSON.stringify(buildEnv[key])
      ),
    content
  )
}
