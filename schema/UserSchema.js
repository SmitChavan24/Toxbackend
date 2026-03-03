
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const uuid = require('uuid');

const userSchema = new Schema({
    id: {
        type: String,
        default: () => uuid.v4(),
    },
    createddate: {
        type: String,
        default: () => new Date().toISOString(),
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
    googleId: {
        type: String,
        required: false,
    },
    phone: {
        type: Number,
        required: false,
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
        required: false,
    }
});

const User = mongoose.model('users', userSchema);

module.exports = User;