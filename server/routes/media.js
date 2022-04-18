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

	const query = await db.query('SELECT media_id, date_taken, filename FROM aperturama.media WHERE owner_user_id = $1', [req.user.sub]);
	// TODO: Error handling

	res.json(query.rows);

})

// GET /media/<id>/media - Retrieve raw media
router.get('/:id(\\d+)/media', auth_media(true), async(req, res) => {

	// Get file extension from original filename in database
	const query = await db.query('SELECT filename FROM aperturama.media WHERE media_id = $1', [req.params['id']]);
	// TODO: Error handling

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
router.get('/:id(\\d+)/thumbnail', auth_media(true), async(req, res) => {

	res.sendFile(process.env['MEDIA_ROOT'] + '/' + req.params['id'] + '.thumbnail.jpg', (err) => {
		if(err){
			res.sendStatus(401);
		}
	});

})

// POST /media - Upload new media
router.post('/', multer.single('mediafile'), async(req, res) => {

	// Parse EXIF data for date taken
	let exif = await exifr.parse(req.file.path, {pick: ['DateTimeOriginal']});
	// TODO: Handle error/no DateTimeOriginal

	// Create media entry in database
	const query = await db.query('INSERT INTO aperturama.media (owner_user_id, date_taken, filename) VALUES ($1, $2, $3) RETURNING media_id', [req.user.sub, exif['DateTimeOriginal'], req.file.originalname]);
	// TODO: Authenticate, get user ID for owner user ID
	// TODO: Error handling

	// Create thumbnail
	const thumbnail = await imageThumbnail(req.file.path, {width: 256, height: 256, fit: 'cover', jpegOptions: {force: true}});
	fs.writeFileSync(process.env['MEDIA_ROOT'] + '/' + query.rows[0]['media_id'] + '.thumbnail.jpg', thumbnail);
	// TODO: Error handling

	// Rename file to media ID
	const extension = req.file.originalname.match(/\.[^.]+$/);
	fs.renameSync(req.file.path, req.file.destination + '/' + query.rows[0]['media_id'] + extension);
	// TODO: Error handling

	res.sendStatus(200);

});

// DELETE /media/<id> - Delete media
router.delete('/:id(\\d+)', auth_media(), async(req, res) => {

	await db.query('DELETE FROM aperturama.media WHERE media_id = $1', [req.params['id']]);
	// TODO: Error handling

	res.sendStatus(200);

})

// POST /media/<id>/share/user - Share media with a user
router.post('/:id(\\d+)/share/user', auth_media(), async(req, res) => {

	// Get shared user's ID from email
	const query = await db.query('SELECT user_id FROM aperturama.user WHERE email = $1', [req.body['email']]);
	// TODO: Error handling

	if(query.rows.length === 1){

		// Share media with the user
		await db.query('INSERT INTO aperturama.media_sharing (media_id, shared_to_user_id) VALUES ($1, $2)', [req.params['id'], query.rows[0]['user_id']]);
		// TODO: Error handling

		res.sendStatus(200);

	}else{
		res.sendStatus(404);
	}

});

// DELETE /media/<id>/share/user - Stop sharing media with a user
router.delete('/:id(\\d+)/share/user', auth_media(), async(req, res) => {

	await db.query('DELETE FROM aperturama.media_sharing WHERE media_id = $1 AND shared_to_user_id = $2', [req.params['id'], req.body['user_id']]);
	// TODO: Error handling

	res.sendStatus(200);

});

// POST /media/<id>/share/link - Share media with a link
router.post('/:id(\\d+)/share/link', auth_media(), async(req, res) => {

	// Create random code for link if not given
	const code = req.body['code'] ?? crypto.randomBytes(32).toString('base64url');

	// Create link in database
	await db.query('INSERT INTO aperturama.media_sharing (media_id, shared_link_code, shared_link_password) VALUES ($1, $2, $3)', [req.params['id'], code, req.body['password'] ?? null]);
	// TODO: Error handling

	res.json({code: code});

});

// DELETE /media/<id>/share/link/<code> - Stop sharing media with a link
router.delete('/:id(\\d+)/share/link/:code', auth_media(), async(req, res) => {

	// Delete shared link
	await db.query('DELETE FROM aperturama.media_sharing WHERE media_id = $1 AND shared_link_code = $2', [req.params['id'], req.params['code']]);
	// TODO: Error handling (invalid code)

	res.sendStatus(200);

});

module.exports = router
