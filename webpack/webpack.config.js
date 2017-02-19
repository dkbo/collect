const path = require('path');
const rules = require('./loaders');
const plugins = require('./webpack.plugins');
const devServer = require('./devServer');

const enterFile = '../src/index.jsx';
const outerPath = '../docs';
const publicPath = '';
module.exports = {
  entry: [
    'webpack-hot-middleware/client?reload=true',
    path.join(__dirname, enterFile), // Your appʼs entry point
  ],
  output: {
    path: path.join(__dirname, outerPath),
    filename: '[name].js',
    publicPath,
  },
  resolve: {
    extensions: ['.js', '.jsx', '.css', '.sass'],
  },
  module: {
    rules,
  },
  devServer,
  plugins,
};
