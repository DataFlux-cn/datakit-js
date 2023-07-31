const fs = require('fs')
const glob = require('glob')
const fsPromises = require('fs/promises')
const { runMain, printError, printLog } = require('./utils')
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
