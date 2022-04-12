const router = require('express').Router()
const {db} = require('../db')

router.get('/', async(req, res) => {

	const query = await db.query('SELECT media_id, date_taken, filename FROM aperturama.media')
	res.json(query.rows)

})

router.get('/:id(\\d+)/media', async(req, res) => {

	// Get file extension from original filename in database
	const query = await db.query('SELECT filename FROM aperturama.media WHERE media_id = $1', [req.params['id']])

	if(query.rows.length === 1){
		const extension = query.rows[0]['filename'].match(/\.[^.]+$/)[0]
		res.sendFile(process.env['MEDIA_ROOT'] + '/' + req.params['id'] + extension, (err) => {
			if(err){
				res.sendStatus(500)
			}
		})
	}else{
		res.sendStatus(404)
	}

})

module.exports = router
