const express = require('express');
const router = express.Router();
const {db} = require('../db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require("fs");

// Hash and salt password using scrypt
function hash(password, salt = crypto.randomBytes(32)){
	return new Promise((resolve, reject) => {

		crypto.scrypt(password.normalize(), salt, 64, async(err, derivedKey) => {
			if(err) reject(err);
			resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
		});

	});
}

// POST /user - Create new user account
router.post('/', async(req, res) => {

	try{

		// Hash and salt password
		const hashString = await hash(req.body['password']);

		// Create new user in database
		await db.query('INSERT INTO users (email, first_name, last_name, password) VALUES ($1, $2, $3, $4)', [req.body['email'], req.body['first_name'], req.body['last_name'], hashString]);

		res.sendStatus(200);

	}catch(err){
		res.sendStatus(500);
	}

});

// POST /user/login - Authenticate and get token
router.post('/login', async(req, res) => {

	// Get user information from database
	const result = await db.query('SELECT user_id, password FROM users WHERE email = $1', [req.body['email']]);

	if(result.rows.length === 1){

		// Check password
		const salt = Buffer.from(result.rows[0]['password'].split(':')[0], 'hex');
		if(await hash(req.body['password'], salt) === result.rows[0]['password']){

			// Generate JWT
			const token = jwt.sign({
				sub: result.rows[0]['user_id']
			}, process.env['JWT_KEY'], {algorithm: 'HS256'});

			res.send(token);

		}else{
			res.sendStatus(401);
		}

	}else{
		res.sendStatus(401);
	}

});

// GET /user - Get user metadata
router.get('/', async(req, res) => {

	// Get user information from database
	const result = await db.query('SELECT user_id, email, first_name, last_name FROM users WHERE user_id = $1', [req.auth['sub']]);

	res.json(result.rows[0]);

});

// PUT /user - Update user info
router.put('/', async(req, res) => {

	// Update name and email
	await db.query('UPDATE users SET (first_name, last_name, email) = ($2, $3, $4) WHERE user_id = $1', [req.auth.sub, req.body['first_name'], req.body['last_name'], req.body['email']]);

	// Update password if given
	if(req.body['password']){

		// Hash and salt password
		const hashString = await hash(req.body['password']);

		// Update hash in database
		await db.query('UPDATE users SET password = $2 WHERE user_id = $1', [req.auth.sub, hashString]);

	}

	res.sendStatus(200);

});

// GET /user/statistics - Get user usage statistics
router.get('/statistics', async(req, res) => {

	let stats = {
		n_media: 0,
		n_collections: 0,
		n_shared: 0,
		bytes_used: 0,
		bytes_total: 0
	};

	// Get media list for user
	const result = await db.query('SELECT media_id, filename FROM media WHERE owner_user_id = $1', [req.auth['sub']]);

	// Media count
	stats['n_media'] = result.rows.length;

	// Get collections count for user
	stats['n_collections'] = parseInt((await db.query('SELECT COUNT(1) AS count FROM collections WHERE owner_user_id = $1', [req.auth['sub']])).rows[0]['count']);

	// Get shared item count for user (sum of shared media and shared collections)
	stats['n_shared'] = parseInt((await db.query('SELECT (SELECT COUNT(1) FROM media_sharing JOIN media ON media_sharing.media_id = media.media_id WHERE owner_user_id = $1) + (SELECT COUNT(1) FROM collection_sharing JOIN collections ON collection_sharing.collection_id = collections.collection_id WHERE owner_user_id = $1) AS count', [req.auth['sub']])).rows[0]['count']);

	// Get disk usage for media and thumbnails
	for(let media of result.rows){
		stats['bytes_used'] += (await fs.promises.stat(process.env['MEDIA_ROOT'] + '/' + media['media_id'] + media['filename'].match(/\.[^.]+$/)[0])).size;
		stats['bytes_used'] += (await fs.promises.stat(process.env['MEDIA_ROOT'] + '/' + media['media_id'] + '.thumbnail.jpg')).size;
	}

	// Get total disk space
	try{
		stats['bytes_total'] = (await require('check-disk-space').default(process.env['MEDIA_ROOT']))['size'];
	}catch(err){
		console.error('Error: Cannot get disk size for MEDIA_ROOT: ' + process.env['MEDIA_ROOT']);
	}

	res.json(stats);

});

module.exports = router
