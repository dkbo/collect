const express = require('express')
const webpack = require('webpack')
const WebpackDevMiddleware = require('webpack-dev-middleware')
const WebpackHotMiddleware = require('webpack-hot-middleware')
const config = require('./webpack.server.config')
const compiler = webpack(config)

const app = express()
app.use(express.static('public'));

app.use(WebpackDevMiddleware(compiler, {
  publicPath: config.output.publicPath,
  stats: {
    chunks: false,
    colors: true,
  }
}))
app.use(WebpackHotMiddleware(compiler))

var router = express.Router()
router.get('/', function (req, res) {
  res.render('index', { message: 'Hey there!'});
  // res.sendFile(path.join(__dirname, 'index.html'));
})
app.use(router)

app.listen(8080, function () {
  console.log('Listening on 8080')
})
