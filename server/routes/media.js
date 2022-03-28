const router = require('express').Router()
const {db} = require('../db')

router.get('/', async(req, res) => {

	const query = await db.query('SELECT COUNT(1) FROM aperturama.media')
	res.json({count: query.rows})

})

module.exports = router
