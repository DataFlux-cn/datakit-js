const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')

const getBaseConfig = (env) => {
  let webConfig = {
    entry: path.resolve(__dirname, 'src/index.js'),
    // resolve: {
    //   fallback: {
    //     assert: false,
    //     buffer: false,
    //     // console: false,
    //     constants: false,
    //     crypto: false,
    //     // domain: false,
    //     // events: false,
    //     http: false,
    //     https: false,
    //     os: false,
    //     fs: false,
    //     path: require.resolve("path-browserify"),
    //     // punycode: false,
    //     // process: false,
    //     // querystring: false,
    //     stream: false,
    //     // string_decoder: false,
    //     // sys: false,
    //     // timers: false,
    //     // tty: false,
    //     // url: false,
    //     // util: require.resolve('util'),
    //     vm: false,
    //     // zlib: false,
    //   }
    // }
  }
  if (env !== 'development') {
    webConfig = Object.assign(webConfig, {
      optimization: {
        minimize: true,
        minimizer: [
          new TerserPlugin({
            terserOptions: {
              compress: {
                drop_console: true
              }
            }
          })
        ]
      }
    })
  }
  return webConfig
}

module.exports = (env, args) => ({
  mode: args.mode,
  devtool: args.mode === 'development' ? 'inline-source-map' : false,
  ...getBaseConfig(args.mode),
  output: {
    filename: 'dataflux-logs.js',
    path:
      args.mode === 'development'
        ? path.resolve(__dirname, 'demo')
        : path.resolve(__dirname, 'bundle')
  }
})
