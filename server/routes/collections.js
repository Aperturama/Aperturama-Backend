const router = require('express').Router();
const {db} = require('../db');

// GET /collections - Retrieve list of user's collections
router.get('/', async(req, res) => {

	const query = await db.query('SELECT collection_id, name FROM aperturama.collection WHERE owner_user_id = $1', [req.user.sub]);
	// TODO: Error handling

	res.json(query.rows);

});

module.exports = router;
