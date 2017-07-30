const path = require('path');
const rules = require('./loaders');
const plugins = require('./webpack.productionPlugins');

const enterFile = '../src/index.jsx';
const outerPath = '../docs';
const publicPath = 'https://dkbo.github.io/collect/';

const resolve = dir => path.join(__dirname, '../src', dir)

module.exports = {
  entry: {
    // polyfill: ['babel-polyfill'],
    react: ['react', 'react-dom', 'react-redux'],
    app: path.join(__dirname, enterFile),
  },
  output: {
    path: path.join(__dirname, outerPath),
    // filename: './js/[name]_[chunkhash].js'
    filename: 'js/[name].js',
    chunkFilename: 'js/[name].js',
    publicPath,
  },
  resolve: {
    extensions: ['.js', '.jsx', '.css', '.sass'],
    alias: {
      '@': resolve(''),
      '@C': resolve('/components'),
      '@P': resolve('/page'),
    },
  },
  module: {
    rules,
  },
  plugins,
};
