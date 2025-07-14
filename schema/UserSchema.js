
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    id: {
        type: String,
        required: true,
    },
    createddate: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    picture: {
        type: String,
        required: false,
    },
    email: {
        type: String,
        required: true,
    },
    mobile: {
        type: Number,
        required: false,
    },
    dob: {
        type: Date,
        required: false,
    },
    gender: {
        type: String,
        required: false,
    },
    password: {
        type: String,
        required: true,
    }
});

const User = mongoose.model('users', userSchema);

module.exports = User;