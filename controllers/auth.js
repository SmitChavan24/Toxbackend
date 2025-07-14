const User = require("../schema/UserSchema");
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const dotenv = require('dotenv');
const JWT_SECRET = process.env.JWT_SECRET;

const GoogleLogin = async (data) => {
    const { email, password } = data;
    try {
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return { message: 'User not found' }
        }

        const isMatch = await bcrypt.compare(password, existingUser.password);
        if (!isMatch) {
            console.log('eeeeee')
            return { message: 'Invalid credentials' }
        }
        const token = jwt.sign(
            { id: existingUser.id, email: existingUser.email },
            JWT_SECRET,
        );

        // Send response
        return {
            message: 'Login successful',
            user: existingUser,
            token,
        }
    } catch (err) {
        console.error('Error fetching user data:', err);
    }
}



const Login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, existingUser.password);
        if (!isMatch) {
            console.log('eeeeee')
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign(
            { id: existingUser.id, email: existingUser.email },
            JWT_SECRET,
            { expiresIn: '1h' } // Adjust expiration as needed
        );

        // Send response
        res.status(200).json({
            message: 'Login successful',
            user: {
                id: existingUser.id,
                name: existingUser.name,
                email: existingUser.email,
            },
            token,
        });
    } catch (err) {
        console.error('Error fetching user data:', err);
    }
}

module.exports = {
    Login, GoogleLogin
}