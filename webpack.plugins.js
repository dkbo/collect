const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = [
	new webpack.NoErrorsPlugin(),
	new webpack.DefinePlugin({
		__HASHPATH__: true,
	}),
	new webpack.HotModuleReplacementPlugin(),
	new HtmlWebpackPlugin({
			template: './src/index.jade',
	}),
	new webpack.ProvidePlugin({
		'Promise': 'es6-promise',
		'fetch': 'imports?this=>global!exports?global.fetch!whatwg-fetch'
	}),
];
