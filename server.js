const path = require('path')
const express = require('express')
const webpack = require('webpack')
const WebpackDevMiddleware = require('webpack-dev-middleware')
const WebpackHotMiddleware = require('webpack-hot-middleware')
const config = require('./webpack.server.config')
const compiler = webpack(config)

const app = express()

var router = express.Router()
router.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
})

app.use(WebpackDevMiddleware(compiler, {
  publicPath: config.output.publicPath,
  stats: {
    chunks: false,
    colors: true,
  }
}))
app.use(WebpackHotMiddleware(compiler))

app.use(router)

app.use(express.static(path.join(__dirname, 'docs')));

app.listen(8080, () => {
  console.log('已經開啟伺服器 http://localhost:8080')
})
