const path = require('path');
const rules = require('./loaders');
const plugins = require('./webpack.plugins');
const devServer = require('./devServer');

const enterFile = '../src/index.jsx';
const outerPath = '../docs';
const publicPath = '';

const resolve = dir => path.join(__dirname, '../src', dir)


module.exports = {
  entry: [
    'webpack-hot-middleware/client?reload=true',
    path.join(__dirname, enterFile), // Your appʼs entry point
  ],
  output: {
    path: path.join(__dirname, outerPath),
    filename: '[name].js',
    chunkFilename: 'js/[name].js',
    publicPath,
  },
  devtool: 'source-map',
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
  devServer,
  plugins,
};
