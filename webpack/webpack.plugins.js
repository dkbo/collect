const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const autoprefixer = require('autoprefixer');

module.exports = [
	new webpack.NoEmitOnErrorsPlugin(),
	new webpack.DefinePlugin({
		__HASHPATH__: true,
	}),
	new webpack.LoaderOptionsPlugin({
		options: {
			postcss: [
				autoprefixer({browsers: ['last 2 versions', 'IE 7']}),
			]
		}
  	}),
	new webpack.HotModuleReplacementPlugin(),
	new HtmlWebpackPlugin({
			template: './src/index.pug',
	}),
	new webpack.ProvidePlugin({
		'Promise': 'es6-promise',
		'fetch': 'imports-loader?this=>global!exports-loader?global.fetch!whatwg-fetch'
	}),
];
