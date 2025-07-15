const mongoose = require('mongoose');
require('dotenv').config();

const url = process.env.MONGODB_URI || 'mongodb+srv://smit:SpFIOMgqROwHPgKt@cluster0.fgvyz.mongodb.net/tox?retryWrites=true&w=majority&appName=Cluster0';
const connectDB = async () => {
    try {
        await mongoose.connect(url, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        });
        console.log('Database is connected');
    } catch (err) {
        console.error('Error connecting to the database:', err);
        process.exit(1);
    }
};

module.exports = connectDB;