const router = require('express').Router();
const {db} = require('../db');
const auth_media = require('../middleware/auth_media');
const auth_collection = require('../middleware/auth_collection');
const crypto = require('crypto');

// GET /collections - Retrieve list of user's collections
router.get('/', async(req, res) => {

	try{
		const query = await db.query('SELECT collection_id, name FROM collections WHERE owner_user_id = $1', [req.auth.sub]);
		res.json(query.rows);
	}catch(err){
		res.sendStatus(500);
	}

});

// GET /collections/shared - Retrieve list of collections shared with user
router.get('/shared', async(req, res) => {

	try{
		let query = await db.query('SELECT collections.collection_id, name FROM collections JOIN collection_sharing ON collections.collection_id=collection_sharing.collection_id WHERE shared_to_user_id = $1', [req.auth.sub]);
		let collections = query.rows;
		for(let i = 0; i < query.rows.length; ++i){
			query = await db.query('SELECT media_id FROM collection_media WHERE collection_id = $1', [collections[i]['collection_id']]);
			collections[i]['media'] = query.rows;
		}

		res.json(collections);
	}catch(err){
		res.sendStatus(500);
	}

});

// POST /collections - Create a new collection
router.post('/', async(req, res) => {

	try{
		await db.query('INSERT INTO collections (owner_user_id, name) VALUES ($1, $2)', [req.auth.sub, req.body['name'] || 'Untitled']);
		res.sendStatus(200);
	}catch(err){
		res.sendStatus(500);
	}

});

// GET /collections/<id> - Get a collection and its media
router.get('/:id(\\d+)', auth_collection(true), async(req, res) => {

	try{
		let collection = {sharing: []};

		// Get collection metadata
		let query = await db.query('SELECT name FROM collections WHERE collection_id = $1', [req.params['id']]);
		collection['name'] = query.rows[0]['name'];

		// Get users shared with
		query = await db.query('SELECT email FROM users JOIN collection_sharing ON users.user_id=collection_sharing.shared_to_user_id WHERE collection_sharing.collection_id = $1 AND collection_sharing.shared_link_code IS NULL', [req.params['id']]);
		if(query.rows.length > 0){
			query.rows.forEach(row => collection['sharing'].push(row));
		}

		// Get links shared with
		query = await db.query('SELECT shared_link_code AS code, shared_link_password AS password FROM collection_sharing WHERE collection_id = $1 AND shared_to_user_id IS NULL', [req.params['id']]);
		if(query.rows.length > 0){
			query.rows.forEach(row => collection['sharing'].push(row));
		}

		// Get media in collection
		query = await db.query('SELECT media_id FROM collection_media WHERE collection_id = $1', [req.params['id']]);
		collection['media'] = query.rows;

		res.json(collection);
	}catch(err){
		res.sendStatus(500);
	}

});

// PUT /collections/<id> - Update a collection (rename)
router.put('/:id(\\d+)', auth_collection(), async(req, res) => {

	try{
		// Update collection name
		await db.query('UPDATE collections SET name = $1 WHERE collection_id = $2', [req.body['name'], req.params['id']]);

		res.sendStatus(200);
	}catch(err){
		res.sendStatus(500);
	}

});

// DELETE /collections/<id> - Delete a collection
router.delete('/:id(\\d+)', auth_collection(),async(req, res) => {

	try{
		// Delete collection
		await db.query('DELETE FROM collections WHERE collection_id = $1', [req.params['id']]);

		res.sendStatus(200);
	}catch(err){
		res.sendStatus(500);
	}

});

// POST /collections/<id> - Add media to collection
router.post('/:id(\\d+)', auth_collection(), auth_media(), async(req, res) => {

	// Add media to collection
	try{
		await db.query('INSERT INTO collection_media (collection_id, media_id) VALUES ($1, $2)', [req.params['id'], req.body['media_id']]);
	}catch(err){
		// Unique violation, meaning media is already in collection
		if(err.code == 23505){
			return res.sendStatus(304);
		}else{
			return res.sendStatus(500);
		}
	}

	res.sendStatus(200);

});

// DELETE /collections/<collectionid>/media/<mediaid> - Remove media from collection
router.delete('/:id(\\d+)/media/:mediaid(\\d+)', auth_collection(), async(req, res) => {

	try{
		// Remove media from collection
		await db.query('DELETE FROM collection_media WHERE collection_id = $1 AND media_id = $2', [req.params['id'], req.params['mediaid']]);

		res.sendStatus(200);
	}catch(err){
		res.sendStatus(500);
	}

});

// POST /collections/<id>/share/user - Share collection with a user
router.post('/:id(\\d+)/share/user', auth_collection(), async(req, res) => {

	try{
		// Get shared user's ID from email
		const query = await db.query('SELECT user_id FROM users WHERE email = $1', [req.body['email']]);

		if(query.rows.length === 1){

			// Share collection with the user
			await db.query('INSERT INTO collection_sharing (collection_id, shared_to_user_id) VALUES ($1, $2)', [req.params['id'], query.rows[0]['user_id']]);

			res.sendStatus(200);

		}else{
			res.sendStatus(404);
		}
	}catch(err){
		res.sendStatus(500);
	}

});

// DELETE /collections/<id>/share/user - Stop sharing collection with a user
router.delete('/:id(\\d+)/share/user', auth_collection(), async(req, res) => {

	try{
		await db.query('DELETE FROM collection_sharing WHERE collection_id = $1 AND shared_to_user_id = $2', [req.params['id'], req.body['user_id']]);

		res.sendStatus(200);
	}catch(err){
		res.sendStatus(500);
	}

});

// POST /collections/<id>/share/link - Share collection with a link
router.post('/:id(\\d+)/share/link', auth_collection(), async(req, res) => {

	try{
		// Create random code for link if not given
		const code = req.body['code'] ?? crypto.randomBytes(32).toString('base64url');

		// Create link in database
		await db.query('INSERT INTO collection_sharing (collection_id, shared_link_code, shared_link_password) VALUES ($1, $2, $3)', [req.params['id'], code, req.body['password'] ?? null]);

		res.json({code: code});
	}catch(err){
		res.sendStatus(500);
	}

});

// DELETE /collections/<id>/share/link/<code> - Stop sharing collection with a link
router.delete('/:id(\\d+)/share/link/:code', auth_collection(), async(req, res) => {

	try{
		// Delete shared link
		await db.query('DELETE FROM collection_sharing WHERE collection_id = $1 AND shared_link_code = $2', [req.params['id'], req.params['code']]);

		res.sendStatus(200);
	}catch(err){
		res.sendStatus(500);
	}

});

// DELETE /collections/<id>/share - Stop sharing collection with anyone
router.delete('/:id(\\d+)/share', auth_collection(), async(req, res) => {

	try{
		// Delete collection sharing entries
		await db.query('DELETE FROM collection_sharing WHERE collection_id = $1', [req.params['id']]);

		res.sendStatus(200);
	}catch(err){
		res.sendStatus(500);
	}

});

module.exports = router;
