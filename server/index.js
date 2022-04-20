// Load environment variables from .env file
require('dotenv').config()

const jwt = require('express-jwt');
const fs = require("fs");

// Initialize Express
const express = require('express');
const app = express();

// The version of the API (included in URL)
const API_VERSION = 'v1'

// Authentication middleware
app.use(jwt({secret: fs.readFileSync(process.env['JWT_KEY']), algorithms: ['HS256']})
.unless({
	path: [
		{url: '/api/' + API_VERSION + '/user', methods: ['POST']},
		{url: '/api/' + API_VERSION + '/user/login'},
		{url: /^\/api\/v\d+\/media\/\d+\/media\/shared/, methods: ['GET']},
		{url: /^\/api\/v\d+\/media\/\d+\/thumbnail\/shared/, methods: ['GET']}
	]
}))
.use((err, req, res, next) => {
	if(err.name === 'UnauthorizedError') {
		res.sendStatus(401);
		return;
	}
	next();
});

// Body parser middleware for URL encoded request data
app.use(express.urlencoded({extended: true}));

// Load routers
app.use('/api/' + API_VERSION + '/user', require('./routes/user'));
app.use('/api/' + API_VERSION + '/media', require('./routes/media'));
app.use('/api/' + API_VERSION + '/collections', require('./routes/collections'));

// Start listening
app.listen(process.env.LISTEN_PORT, () => {
	console.log('Listening on port ' + process.env.LISTEN_PORT)
})
