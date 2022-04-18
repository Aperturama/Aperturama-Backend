const router = require('express').Router()
const multer = require('multer')({dest: process.env['MEDIA_ROOT'] + '/'});
const {db} = require('../db')
const fs = require("fs");
const exifr = require('exifr');
const imageThumbnail = require('image-thumbnail');

// GET /media - Retrieve list of user's media
router.get('/', async(req, res) => {

	const query = await db.query('SELECT media_id, date_taken, filename FROM aperturama.media WHERE owner_user_id = $1', [req.user.sub]);
	// TODO: Error handling

	res.json(query.rows);

})

// GET /media/<id>/media - Retrieve raw media
router.get('/:id(\\d+)/media', async(req, res) => {

	// Get file extension from original filename in database
	const query = await db.query('SELECT owner_user_id, filename FROM aperturama.media WHERE media_id = $1', [req.params['id']]);
	// TODO: Error handling

	if(query.rows.length === 1){

		// Check that authenticated user is owner
		if(query.rows[0]['owner_user_id'] === req.user.sub){

			const extension = query.rows[0]['filename'].match(/\.[^.]+$/)[0];
			res.sendFile(process.env['MEDIA_ROOT'] + '/' + req.params['id'] + extension, (err) => {
				if(err){
					res.sendStatus(500);
				}
			});

		}else{
			res.sendStatus(401);
		}

	}else{
		res.sendStatus(401);
	}

})

// GET /media/<id>/thumbnail - Retrieve raw thumbnail
router.get('/:id(\\d+)/thumbnail', async(req, res) => {

	// Check if authenticated user is authorized
	const query = await db.query('SELECT owner_user_id FROM aperturama.media WHERE media_id = $1', [req.params['id']]);
	// TODO: Error handling

	if(query.rows.length === 1 && query.rows[0]['owner_user_id'] === req.user.sub){

		res.sendFile(process.env['MEDIA_ROOT'] + '/' + req.params['id'] + '.thumbnail.jpg', (err) => {
			if(err){
				res.sendStatus(401);
			}
		})

	}else{
		res.sendStatus(401);
	}

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
router.delete('/:id(\\d+)', async(req, res) => {

	// Check if user has access to media
	const query = await db.query('SELECT owner_user_id FROM aperturama.media WHERE media_id = $1', [req.params['id']]);
	// TODO: Error handling

	if(query.rows.length === 1 && query.rows[0]['owner_user_id'] === req.user.sub){

		// Delete media
		await db.query('DELETE FROM aperturama.media WHERE media_id = $1', [req.params['id']]);
		// TODO: Error handling

		res.sendStatus(200);

	}else{
		res.sendStatus(401);
	}

})

// POST /media/<id>/share/user - Share media with a user
router.post('/:id(\\d+)/share/user', async(req, res) => {

	// Check if user has access to media
	let query = await db.query('SELECT owner_user_id FROM aperturama.media WHERE media_id = $1', [req.params['id']]);
	// TODO: Error handling

	if(query.rows.length === 1 && query.rows[0]['owner_user_id'] === req.user.sub){

		// Get shared user's ID from email
		query = await db.query('SELECT user_id FROM aperturama.user WHERE email = $1', [req.query['email']]);
		// TODO: Error handling
		if(query.rows.length === 1){

			// Share media with the user
			await db.query('INSERT INTO aperturama.media_sharing (media_id, shared_to_user_id) VALUES ($1, $2)', [req.params['id'], query.rows[0]['user_id']]);
			// TODO: Error handling

			res.sendStatus(200);

		}else{
			res.sendStatus(404);
		}

	}else{
		res.sendStatus(401);
	}

});

module.exports = router
