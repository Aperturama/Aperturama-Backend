const {db} = require('../db');

module.exports = (check_shared = false) => {
	return async(req, res, next) => {

		const media_id = req.body['media_id'] ?? req.params['id'];// Get media ID from URL if not given in body
		const user_id = req.user.sub;// Get authenticated user ID from token

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
			const share_code = req.body['code'] ?? null;
			const share_password = req.body['password'] ?? null;

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

			// TODO: Check if media is in shared collection that user has access to

			// TODO: Check if media is in shared collection that code has access to

		}

		// User is not authorized for this media
		res.sendStatus(401);

	}
};
