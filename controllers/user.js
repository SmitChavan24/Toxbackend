const User = require("../schema/UserSchema");
const uuid = require('uuid')
const bcrypt = require('bcrypt');
const { GoogleLogin } = require("./auth");


const getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ message: 'Get user', user: users })
    } catch (err) {
        console.error('Error fetching user data:', err);
    }
}
const getUsersbyEmail = async (req, res) => {
    try {
        const { email } = req.query;
        console.log(email)
        if (!email) {
            return res.status(400).json({ message: "Email query parameter is required" });
        }

        const users = await User.find({
            email: { $regex: new RegExp(email, 'i') } // case-insensitive partial match
        });
        console.log(users, "by email")
        res.status(200).json({ message: 'Users found', users });
    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


const Gsignin = async (req, res) => {
    const { name, email, picture, sub } = req.body;
    const createddate = new Date();
    const id = uuid.v4()
    const password = sub

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser && req?.body?.sub) {
            const response = await GoogleLogin({ email, password })
            console.log(response, "response")
            return res.status(200).json(response);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const result = new User({ id, createddate, picture, name, email, password: hashedPassword })
        await result.save()
        const response = await GoogleLogin({ email, password })
        res.status(200).json(response)
    } catch (error) {
        console.log(error, "error")
        res.status(500).json({ error })
    }

}


const createUser = async (req, res) => {
    const { createddate, firstname, lastname, email, gender, dateofbirth, password, phone, confirmpassword } = req.body;

    console.log(req.body, "afas")

    const id = uuid.v4()
    const name = firstname + lastname
    const dob = dateofbirth

    if (!email || !password || !phone) {
        return res.status(400).json({ error: 'Email, Phone, and Password are required' });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists with this email' });
        }
        // Hash password
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            return res.status(409).json({ error: 'User already exists with this phone number' });
        }
        console.log('first')
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const result = new User({ id, createddate: createddate ? createddate : new Date(), name, email, phone, password: hashedPassword, dob, gender })
        await result.save()
        res.status(200).json({ message: 'User register successfully' })
    } catch (error) {
        console.log(error, "error")
        res.status(500).json({ error })
    }

}

const updateUser = async (req, res) => {
    // const { id } = req.params;
    const { id, firstname, lastname, email, phone, gender, dateofbirth } = req.body;

    try {
        // Check if user exists
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if email already exists for another user
        if (email) {
            const existingEmail = await User.findOne({ email, _id: { $ne: id } });
            if (existingEmail) {
                return res.status(409).json({ error: "Email already in use" });
            }
        }

        // Check if phone already exists for another user
        if (phone) {
            const existingPhone = await User.findOne({ phone, _id: { $ne: id } });
            if (existingPhone) {
                return res.status(409).json({ error: "Phone number already in use" });
            }
        }

        // Update fields
        user.name = firstname && lastname ? `${firstname} ${lastname}` : user.name;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        if (gender) user.gender = gender;
        if (dateofbirth) user.dob = dateofbirth;

        await user.save();

        res.status(200).json({ message: "User updated successfully", user });
    } catch (error) {
        console.error(error, "error");
        res.status(500).json({ error: "Internal server error" });
    }
}

const deleteUser = (req, res) => {
    res.status(200).json({ message: `Delete user ${req.params.id}` })
}

module.exports = {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    Gsignin,
    getUsersbyEmail
}