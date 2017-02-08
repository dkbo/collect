const path = require('path')
const express = require('express')
const app = express()
const webpack = require('webpack')
const WebpackDevMiddleware = require('webpack-dev-middleware')
const WebpackHotMiddleware = require('webpack-hot-middleware')
const config = require('../webpack/webpack.config')
const route = require('./route')
const compiler = webpack(config)

app.use(WebpackDevMiddleware(compiler, {
  publicPath: config.output.publicPath,
  stats: {
    chunks: false,
    colors: true,
  }
}))

app.use(WebpackHotMiddleware(compiler))

// app.use(route)

// app.use(express.static(path.join(__dirname, '../', 'docs')));

app.listen(8080, () => {
  console.log('已經開啟伺服器 http://localhost:8080')
})
