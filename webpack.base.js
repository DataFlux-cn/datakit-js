const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')
const getEnv = require('./scripts/build-env')
module.exports = ({
  entry,
  mode,
  path,
  filename,
  types,
  keepBuildEnvVariables
}) => ({
  entry,
  mode,
  output: {
    filename,
    path
  },
  target: ['web', 'es5'],
  devtool: false,
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false
      })
    ]
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin(
      mode === 'development'
        ? // Use an inline source map during development (default options)
          {}
        : // When bundling for release, produce a source map file so it can be used for source code integration,
          // but don't append the source map comment to bundles as we don't upload the source map to
          // the CDN (yet).
          {
            filename: '[file].map',
            append: false
          }
    ),
    new webpack.DefinePlugin(
      !keepBuildEnvVariables
        ? {
            __BUILD_ENV__SDK_VERSION__: JSON.stringify(getEnv(mode).SDK_VERSION)
          }
        : {}
    )
  ]
})
