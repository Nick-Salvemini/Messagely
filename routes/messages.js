const Router = require('express').Router;
const Message = require('../models/message');
const { ensureLoggedIn, ensureCorrectUser } = require('../middleware/auth');
const { DB_URI } = require('../config');
const db = require('../db')
const router = new Router();

/** GET /:id - get detail of message.
 *
 * => {message: {id,
 *               body,
 *               sent_at,
 *               read_at,
 *               from_user: {username, first_name, last_name, phone},
 *               to_user: {username, first_name, last_name, phone}}
 *
 * Make sure that the currently-logged-in users is either the to or from user.
 *
 **/

router.get('/', ensureLoggedIn, async function (req, res, next) {
    try {
        let messages = await Message.all();
        return res.json({ messages });
    }

    catch (err) {
        return next(err);
    }
});


/** POST / - post message.
 *
 * {to_username, body} =>
 *   {message: {id, from_username, to_username, body, sent_at}}
 *
 **/


router.post('/', ensureLoggedIn, async function (req, res, next) {
    try {
        const { to_username, body } = req.body

        const results = await db.query(`
        INSERT INTO messages (from_username, to_username, body, sent_at)
        VALUES ($1, $2, $3, $4)
        RETURNING from_username, to_username, body, sent_at
        ` [req.user.username, to_username, body, new Date()]);

        return res.json({ message: { id, from_username, to_username, body, sent_at } });
    }

    catch (err) {
        return next(err);
    }
})


/** POST/:id/read - mark message as read:
 *
 *  => {message: {id, read_at}}
 *
 * Make sure that the only the intended recipient can mark as read.
 *
 **/

router.post('/:id/read', ensureLoggedIn, async function (req, res, next) {
    try {
        const messageId = req.params.id;
        const username = req.user.username;

        const message = await Message.get(messageId);
        if (message.to_user.username !== username) {
            throw new Error('Unauthorized to mark this message as read');
        }

        const results = await db.query(`
            UPDATE messages
            SET read_at = $1
            WHERE id = $2
            RETURNING id, read_at
        `, [new Date(), messageId]);

        const { id, read_at } = results.rows[0];

        return res.json({ message: { id, read_at } });
    } catch (err) {
        return next(err);
    }
});