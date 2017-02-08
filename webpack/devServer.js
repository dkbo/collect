const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 8080;
module.exports = {
	// contentBase: '../src',
	// do not print bundle build stats
	noInfo: true,
	// enable HMR
	hot: true,
	// embed the webpack-dev-server runtime into the bundle
	inline: true,
	// open browser
	open: true,
	// serve index.html in place of 404 responses to allow HTML5 history
	historyApiFallback: true,
	port: PORT,
	host: HOST
};
