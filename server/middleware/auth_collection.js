const {db} = require('../db');

module.exports = (check_shared = false) => {
	return async(req, res, next) => {

		const collection_id = req.params['id'];// Get collection ID from URL parameter
		const user_id = req.user.sub;// Get authenticated user ID from token

		// Check if authenticated user is owner of collection
		try{
			const query = await db.query('SELECT COUNT(1) AS count FROM aperturama.collection WHERE collection_id = $1 AND owner_user_id = $2', [collection_id, user_id]);
			if(parseInt(query.rows[0]['count']) === 1){
				return next();// Continue since authorized
			}
		}catch(err){
			res.sendStatus(500);
		}

		// Check if non-owner has access to collection through sharing, and TODO: check privileges
		if(check_shared){

			// Check if authenticated user has shared access to media
			try{
				const query = await db.query('SELECT COUNT(1) AS count FROM aperturama.collection_sharing WHERE collection_id = $1 AND shared_to_user_id = $2', [collection_id, user_id]);
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
					const query = await db.query('SELECT COUNT(1) AS count FROM aperturama.collection_sharing WHERE collection_id = $1 AND shared_link_code = $2 AND (shared_link_password IS NULL OR shared_link_password = $3)', [collection_id, share_code, share_password]);
					if(parseInt(query.rows[0]['count']) === 1){
						return next();// Continue since authorized
					}
				}catch(err){
					res.sendStatus(500);
				}

			}

		}

		// User is not authorized for this collection
		res.sendStatus(401);

	}
};
