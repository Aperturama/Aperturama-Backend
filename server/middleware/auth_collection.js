const {db} = require('../db');

module.exports = () => {
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

		// TODO: Check if non-owner has access to collection through sharing, and check privileges

		// User is not authorized for this collection
		res.sendStatus(401);

	}
};
