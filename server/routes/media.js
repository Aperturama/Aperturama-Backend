const router = require('express').Router()
const multer = require('multer')({dest: process.env['MEDIA_ROOT'] + '/'});
const {db} = require('../db')
const fs = require("fs");
const exifr = require('exifr');
const imageThumbnail = require('image-thumbnail');
const crypto = require('crypto');
const auth_media = require('../middleware/auth_media');

// GET /media - Retrieve list of user's media
router.get('/', async(req, res) => {

	const query = await db.query('SELECT media_id, date_taken, filename FROM media WHERE owner_user_id = $1', [req.user.sub]);

	res.json(query.rows);

});

// GET /media/shared - Retrieve list of media shared with user
router.get('/shared', async(req, res) => {

	const query = await db.query('SELECT media.media_id, date_taken, filename FROM media JOIN media_sharing ON media.media_id=media_sharing.media_id WHERE shared_to_user_id = $1', [req.user.sub]);

	res.json(query.rows);

});

// GET /media/checkhash - Check if a media hash has already been uploaded for the user
router.get('/checkhash', async(req, res) => {

	// Check for media with given hash owned by authenticated user
	const query = await db.query('SELECT COUNT(1) AS count FROM media WHERE hash = $1 AND owner_user_id = $2', [req.body['hash'], req.user.sub]);

	if(parseInt(query.rows[0]['count']) > 0){
		res.sendStatus(304);// If found, return 304 Not Modified
	}else{
		res.sendStatus(204);// If not found, return 204 No Content
	}

});

// GET /media/<id> - Get media metadata and sharing status
router.get('/:id(\\d+)', auth_media(true), async(req, res) => {

	let media = {sharing: []};

	// Get media metadata
	let query = await db.query('SELECT date_uploaded, date_taken, filename FROM media WHERE media_id = $1', [req.params['id']]);
	media['date_uploaded'] = query.rows[0]['date_uploaded'];
	media['date_taken'] = query.rows[0]['date_taken'];
	media['filename'] = query.rows[0]['filename'];

	// Get users shared with
	query = await db.query('SELECT email FROM users JOIN media_sharing ON users.user_id=media_sharing.shared_to_user_id WHERE media_sharing.media_id = $1 AND media_sharing.shared_link_code IS NULL', [req.params['id']]);
	if(query.rows.length > 0){
		query.rows.forEach(row => media['sharing'].push(row));
	}

	// Get links shared with
	query = await db.query('SELECT shared_link_code AS code, shared_link_password AS password FROM media_sharing WHERE media_id = $1 AND shared_to_user_id IS NULL', [req.params['id']]);
	if(query.rows.length > 0){
		query.rows.forEach(row => media['sharing'].push(row));
	}

	// Get shared collections media is part of
	query = await db.query('SELECT name AS collection FROM collections JOIN collection_sharing ON collections.collection_id=collection_sharing.collection_id JOIN collection_media ON collection_sharing.collection_id=collection_media.collection_id WHERE collection_media.media_id = $1', [req.params['id']]);
	if(query.rows.length > 0){
		query.rows.forEach(row => media['sharing'].push(row));
	}

	res.json(media);

});

// GET /media/<id>/media - Retrieve raw media
router.get('/:id(\\d+)/media/:shared(shared)?', auth_media(true), async(req, res) => {

	// Get file extension from original filename in database
	const query = await db.query('SELECT filename FROM media WHERE media_id = $1', [req.params['id']]);

	if(query.rows.length === 1){

		const extension = query.rows[0]['filename'].match(/\.[^.]+$/)[0];
		res.sendFile(process.env['MEDIA_ROOT'] + '/' + req.params['id'] + extension, (err) => {
			if(err){
				res.sendStatus(500);
			}
		});

	}else{
		res.sendStatus(500);
	}

})

// GET /media/<id>/thumbnail - Retrieve raw thumbnail
router.get('/:id(\\d+)/thumbnail/:shared(shared)?', auth_media(true), async(req, res) => {

	res.sendFile(process.env['MEDIA_ROOT'] + '/' + req.params['id'] + '.thumbnail.jpg', (err) => {
		if(err){
			res.sendStatus(401);
		}
	});

})

// POST /media - Upload new media
router.post('/', multer.any(), async(req, res) => {

	// Check that single file was uploaded
	if(!req.files || req.files.length !== 1){
		console.log(req);
		res.sendStatus(400);
		return;
	}

	let file = req.files[0];

	// Parse EXIF data for date taken
	let exif;
	try{
		exif = await exifr.parse(file.path, {pick: ['DateTimeOriginal']}) ?? {DateTimeOriginal: null};
	}catch(err){
		exif = {DateTimeOriginal: null};
	}

	// Compute hash of media
	const hash = crypto.createHash('sha256').update(await fs.promises.readFile(file.path)).digest('hex');

	// Create media entry in database
	const query = await db.query('INSERT INTO media (owner_user_id, date_taken, filename, hash) VALUES ($1, $2, $3, $4) RETURNING media_id', [req.user.sub, exif['DateTimeOriginal'], file.originalname, hash]);

	// Create thumbnail
	const thumbnail = await imageThumbnail(file.path, {width: 256, height: 256, fit: 'cover', jpegOptions: {force: true}});
	await fs.promises.writeFile(process.env['MEDIA_ROOT'] + '/' + query.rows[0]['media_id'] + '.thumbnail.jpg', thumbnail);

	// Rename file to media ID
	const extension = file.originalname.match(/\.[^.]+$/);
	await fs.promises.rename(file.path, file.destination + '/' + query.rows[0]['media_id'] + extension);

	res.json(query.rows[0]);

});

// DELETE /media/<id> - Delete media
router.delete('/:id(\\d+)', auth_media(), async(req, res) => {

	await db.query('DELETE FROM media WHERE media_id = $1', [req.params['id']]);

	res.sendStatus(200);

})

// POST /media/<id>/share/user - Share media with a user
router.post('/:id(\\d+)/share/user', auth_media(), async(req, res) => {

	// Get shared user's ID from email
	const query = await db.query('SELECT user_id FROM users WHERE email = $1', [req.body['email']]);

	if(query.rows.length === 1){

		// Share media with the user
		await db.query('INSERT INTO media_sharing (media_id, shared_to_user_id) VALUES ($1, $2)', [req.params['id'], query.rows[0]['user_id']]);

		res.sendStatus(200);

	}else{
		res.sendStatus(404);
	}

});

// DELETE /media/<id>/share/user - Stop sharing media with a user
router.delete('/:id(\\d+)/share/user', auth_media(), async(req, res) => {

	await db.query('DELETE FROM media_sharing WHERE media_id = $1 AND shared_to_user_id = $2', [req.params['id'], req.body['user_id']]);

	res.sendStatus(200);

});

// POST /media/<id>/share/link - Share media with a link
router.post('/:id(\\d+)/share/link', auth_media(), async(req, res) => {

	// Create random code for link if not given
	const code = req.body['code'] ?? crypto.randomBytes(32).toString('base64url');

	// Create link in database
	await db.query('INSERT INTO media_sharing (media_id, shared_link_code, shared_link_password) VALUES ($1, $2, $3)', [req.params['id'], code, req.body['password'] ?? null]);

	res.json({code: code});

});

// DELETE /media/<id>/share/link/<code> - Stop sharing media with a link
router.delete('/:id(\\d+)/share/link/:code', auth_media(), async(req, res) => {

	// Delete shared link
	await db.query('DELETE FROM media_sharing WHERE media_id = $1 AND shared_link_code = $2', [req.params['id'], req.params['code']]);

	res.sendStatus(200);

});

// DELETE /media/<id>/share - Stop sharing media with anyone
router.delete('/:id(\\d+)/share', auth_media(), async(req, res) => {

	// Delete media sharing entries
	await db.query('DELETE FROM media_sharing WHERE media_id = $1', [req.params['id']]);

	res.sendStatus(200);

});

module.exports = router
