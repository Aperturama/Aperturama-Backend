// Load environment variables from .env file
require('dotenv').config()

// Initialize Express
const app = require('express')()

// Define routes
app.get('/', (req, res) => {
	res.send('Hello World')
})

// Start listening
app.listen(process.env.LISTEN_PORT, () => {
	console.log('Listening on port ' + process.env.LISTEN_PORT)
})
