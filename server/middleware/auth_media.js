const {db} = require('../db');

// Middleware for authorizing access to a media item
module.exports = (check_shared = false) => {
	return async(req, res, next) => {

		const media_id = req.body['media_id'] ?? req.params['id'];// Get media ID from URL if not given in body
		const user_id = req.user ? req.user.sub : null;// Get authenticated user ID from token

		// Check if authenticated user is owner of media
		try{
			const query = await db.query('SELECT COUNT(1) AS count FROM aperturama.media WHERE media_id = $1 AND owner_user_id = $2', [media_id, user_id]);
			if(parseInt(query.rows[0]['count']) === 1){
				return next();// Continue since authorized
			}
		}catch(err){
			res.sendStatus(500);
		}

		// Check if non-owner has access to media through sharing
		if(check_shared){

			// Check if authenticated user has shared access to media
			try{
				const query = await db.query('SELECT COUNT(1) AS count FROM aperturama.media_sharing WHERE media_id = $1 AND shared_to_user_id = $2', [media_id, user_id]);
				if(parseInt(query.rows[0]['count']) === 1){
					return next();// Continue since authorized
				}
			}catch(err){
				res.sendStatus(500);
			}

			// Check if user has shared link access to media
			const share_code = req.body['code'] ?? req.query['code'] ?? null;
			const share_password = req.body['password'] ?? req.query['password'] ?? null;

			if(share_code){

				try{
					const query = await db.query('SELECT COUNT(1) AS count FROM aperturama.media_sharing WHERE media_id = $1 AND shared_link_code = $2 AND (shared_link_password IS NULL OR shared_link_password = $3)', [media_id, share_code, share_password]);
					if(parseInt(query.rows[0]['count']) === 1){
						return next();// Continue since authorized
					}
				}catch(err){
					res.sendStatus(500);
				}

			}

			// Check if media is in shared collection that user has access to
			try{
				const query = await db.query('SELECT COUNT(1) FROM aperturama.collection_media JOIN aperturama.collection_sharing ON collection_media.collection_id=collection_sharing.collection_id WHERE collection_media.media_id = $1 AND collection_sharing.shared_to_user_id = $2', [media_id, user_id]);
				if(parseInt(query.rows[0]['count']) > 0){
					return next();// Continue since authorized
				}
			}catch(err){
				res.sendStatus(500);
			}

			// Check if media is in shared collection that code has access to
			if(share_code){

				try{
					const query = await db.query('SELECT COUNT(1) FROM aperturama.collection_media JOIN aperturama.collection_sharing ON collection_media.collection_id=collection_sharing.collection_id WHERE collection_media.media_id = $1 AND collection_sharing.shared_link_code = $2 AND (shared_link_password IS NULL OR shared_link_password = $3)', [media_id, share_code, share_password]);
					if(parseInt(query.rows[0]['count']) === 1){
						return next();// Continue since authorized
					}
				}catch(err){
					res.sendStatus(500);
				}

			}

		}

		// User is not authorized for this media
		res.sendStatus(401);

	}
};
