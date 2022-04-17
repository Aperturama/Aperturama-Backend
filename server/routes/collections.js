const router = require('express').Router();
const {db} = require('../db');

// GET /collections - Retrieve list of user's collections
router.get('/', async(req, res) => {

	const query = await db.query('SELECT collection_id, name FROM aperturama.collection WHERE owner_user_id = $1', [req.user.sub]);
	// TODO: Error handling

	res.json(query.rows);

});

// POST /collections - Create a new collection
router.post('/', async(req, res) => {

	await db.query('INSERT INTO aperturama.collection (owner_user_id, name) VALUES ($1, $2)', [req.user.sub, req.query['name'] || 'Untitled']);
	// TODO: Error handling

	res.sendStatus(200);

});

module.exports = router;
