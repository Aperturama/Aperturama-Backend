const router = require('express').Router()
const {db} = require('../db')

router.get('/', async(req, res) => {

	const query = await db.query('SELECT media_id, date_taken, filename FROM aperturama.media')
	res.json(query.rows)

})

module.exports = router
