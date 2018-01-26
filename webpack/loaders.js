const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const isProduction = () => process.argv.indexOf('-p') !== -1
const imgLoad = ext => `url-loader?limit=10000&mimetype=image/${ext}&name=images/[name].[ext]`
const compassPath = 'includePaths[]=' + path.join(__dirname, '../node_modules/compass-mixins/lib')
const autoprefixer = require('autoprefixer')
const postCss = {
	loader: 'postcss-loader',
	options: {
		ident: 'postcss',
		plugins: [
			autoprefixer({ browsers: ['> 0%'] })
		]
	}
}

const sassUse = () => (
	isProduction() ?
		ExtractTextPlugin.extract({
			fallback: 'style-loader',
			use: [
				'css-loader',
				postCss,
				`sass-loader?${compassPath}`,
			]
		}) :
		[
			'style-loader',
			'css-loader',
			postCss,
			`sass-loader?${compassPath}`,
		]
)
module.exports = [
	{
		test: /\.jsx?$/,
		exclude: /(node_modules|bower_components)/,
		use: 'babel-loader',
	},
	{ 	test: /\.pug$/, use: 'pug-loader' },
	{ 	test: /\.s?a?c?ss$/,
		use: sassUse()
	},
	{ 	test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, use: 'file-loader' },
	{ 	test: /\.(woff|woff2)$/, use: 'url-loader?prefix=font/&limit=5000' },
	{ 	test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, use: 'url-loader?limit=10000&mimetype=application/octet-stream' },
	{ 	test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, use: 'url-loader?limit=10000&mimetype=image/svg+xml' },
	{ 	test: /\.gif/, use: imgLoad('gif') },
	{ 	test: /\.jpg/, use: imgLoad('jpg') },
	{ 	test: /\.png/, use: imgLoad('png') },
];



