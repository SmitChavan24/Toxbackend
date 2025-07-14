const express = require('express');
const { getUsers, createUser, Gsignin, getUsersbyEmail } = require('../controllers/user');
const { Login } = require('../controllers/auth');
const router = express.Router();

router.route('/').get(getUsers)
router.route('/register').post(createUser)
router.route('/login').post(Login)
router.route('/gsignin').post(Gsignin)
router.route('/searchbyemail').get(getUsersbyEmail)

module.exports = router;