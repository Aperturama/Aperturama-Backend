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

// PUT /collections/<id> - Update a collection (rename)
router.put('/:id(\\d+)', async(req, res) => {

	// Check if user has access to collection
	const query = await db.query('SELECT owner_user_id FROM aperturama.collection WHERE collection_id = $1', [req.params['id']]);
	if(query.rows.length === 1 && query.rows[0]['owner_user_id'] === req.user.sub){

		// Update collection name
		await db.query('UPDATE aperturama.collection SET name = $1 WHERE collection_id = $2', [req.query['name'], req.params['id']]);

		res.sendStatus(200);

	}else{
		res.sendStatus(401);
	}

});

// POST /collections/<id> - Add media to collection
router.post('/:id(\\d+)', async(req, res) => {

	// Check if user has access to collection
	let query = await db.query('SELECT owner_user_id FROM aperturama.collection WHERE collection_id = $1', [req.params['id']]);
	// TODO: Error handling
	if(query.rows.length === 1 && query.rows[0]['owner_user_id'] === req.user.sub){

		// Check if user has access to media
		query = await db.query('SELECT owner_user_id FROM aperturama.media WHERE media_id = $1', [req.query['media_id']]);
		if(query.rows.length === 1 && query.rows[0]['owner_user_id'] === req.user.sub){
		// TODO: Error handling

			// Add media to collection
			await db.query('INSERT INTO aperturama.collection_media (collection_id, media_id) VALUES ($1, $2)', [req.params['id'], req.query['media_id']]);
			// TODO: Error handling

			res.sendStatus(200);

		}else{
			res.sendStatus(401);
		}

	}else{
		res.sendStatus(401);
	}

});

module.exports = router;
