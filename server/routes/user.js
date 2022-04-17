const express = require('express');
const router = express.Router();
const {db} = require('../db');
const crypto = require('crypto');

// POST /user - Create new user account
router.post('/', async(req, res) => {

	// Hash and salt password
	crypto.scrypt(req.query['password'].normalize(), crypto.randomBytes(32), 64, async(err, derivedKey) => {

		if(!err){

			// Create new user in database
			const result = await db.query('INSERT INTO aperturama.user (email, first_name, last_name, password) VALUES ($1, $2, $3, $4)', [req.query['email'], req.query['first_name'], req.query['last_name'], derivedKey.toString('hex')]);
			// TODO: Error handling

			res.sendStatus(200);

		}else{
			res.sendStatus(500);
		}

	});

});

module.exports = router
