const spawn = require('child_process').spawn

const resetColor = '\x1b[0m'

exports.printError = (...params) => {
  const redColor = '\x1b[31;1m'
  console.log(redColor, ...params, resetColor)
}
exports.printLog = (...params) => {
  const greenColor = '\x1b[32;1m'
  console.log(greenColor, ...params, resetColor)
}

exports.spawnCommand = function (command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true })
    child.on('error', reject)
    child.on('close', resolve)
    child.on('exit', resolve)
  })
}
exports.runMain = (mainFunction) => {
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
