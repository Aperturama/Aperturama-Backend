// Load environment variables from .env file
require('dotenv').config()

// Initialize Express
const app = require('express')()

// The version of the API (included in URL)
const API_VERSION = 'v1'

// Load routers
app.use('/api/' + API_VERSION + '/media', require('./routes/media'))

// Start listening
app.listen(process.env.LISTEN_PORT, () => {
	console.log('Listening on port ' + process.env.LISTEN_PORT)
})
