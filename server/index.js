// Load environment variables from .env file
require('dotenv').config()

const jwt = require('express-jwt');
const fs = require("fs");

// Initialize Express
const app = require('express')()

// The version of the API (included in URL)
const API_VERSION = 'v1'

// Authentication middleware
app.use(jwt({secret: fs.readFileSync(process.env['JWT_KEY']), algorithms: ['HS256']})
.unless({
	path: [
		{url: '/api/' + API_VERSION + '/user', methods: ['POST']},
		{url: '/api/' + API_VERSION + '/user/login'}
	]
}))
.use((err, req, res, next) => {
	if(err.name === 'UnauthorizedError') {
		res.sendStatus(401);
		return;
	}
	next();
});

// Load routers
app.use('/api/' + API_VERSION + '/user', require('./routes/user'));
app.use('/api/' + API_VERSION + '/media', require('./routes/media'));
app.use('/api/' + API_VERSION + '/collections', require('./routes/collections'));

// Start listening
app.listen(process.env.LISTEN_PORT, () => {
	console.log('Listening on port ' + process.env.LISTEN_PORT)
})
