const path = require('path');
const loaders = require('./webpack.loaders');
const plugins = require('./webpack.plugins');
const autoprefixer = require('autoprefixer');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || '8080';
const enterFile = 'src/index.jsx';
const outerPath = 'docs';
const publicPath = 'http://localhost:8080/';
module.exports = {
	entry: [
		`webpack-hot-middleware/client?reload=true`,
		path.join(__dirname, enterFile), // Your appʼs entry point

	],
	output: {
		path: path.join(__dirname, outerPath),
		filename: '[name].js',
        publicPath,
	},
	resolve: {
		extensions: ['', '.js', '.jsx', '.css', '.sass']
	},
	module: {
		loaders
	},
	postcss: () => {
		return [autoprefixer({browsers: ['last 2 versions', 'IE 7']})]
	},
	devServer: {
		contentBase: './src',
		// do not print bundle build stats
		noInfo: true,
		// enable HMR
		hot: true,
		// embed the webpack-dev-server runtime into the bundle
		inline: true,
		// serve index.html in place of 404 responses to allow HTML5 history
		historyApiFallback: true,
		port: PORT,
		host: HOST
	},
	plugins: plugins
};
