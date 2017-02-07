const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const isProduction = () => process.argv.indexOf('-p') !== -1
const imgLoad = ext => `url?limit=10000&mimetype=image/${ext}&name=images/[name].[ext]`
const compassPath = 'includePaths[]=' + path.resolve(__dirname, './node_modules/compass-mixins/lib')
module.exports = [
	{
		test: /\.jsx?$/,
		exclude: /(node_modules|bower_components)/,
		loader: 'react-hot!babel',
	},
	{ test: /\.pug$/, loader: 'pug' },
	{ test: /\.s?a?c?ss$/, loader: isProduction() ? ExtractTextPlugin.extract('style', `css!postcss!sass?${compassPath}`) : `style!css!postcss!sass?${compassPath}` },
	{ test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, loader: 'file' },
	{ test: /\.(woff|woff2)$/, loader: 'url?prefix=font/&limit=5000' },
	{ test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, loader: 'url?limit=10000&mimetype=application/octet-stream' },
	{ test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, loader: 'url?limit=10000&mimetype=image/svg+xml' },
	{ test: /\.gif/, loader: imgLoad('gif') },
	{ test: /\.jpg/, loader: imgLoad('jpg') },
	{ test: /\.png/, loader: imgLoad('png') },
];
