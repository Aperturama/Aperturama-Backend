const router = require('express').Router()

router.get('/', (req, res) => {
	res.json({test: 'Hello World'})
})

module.exports = router
