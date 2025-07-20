const express = require('express')
const cors = require("cors");
const dotenv = require('dotenv');
const connectDB = require('./db/mongodb/connect')
const User = require('./schema/UserSchema')
const { Canvas, Image } = require('canvas')
const canvas = require('canvas')
const { OAuth2Client } = require('google-auth-library');
const app = express();
const _ = require('lodash')
const { Server } = require("socket.io");
const amqp = require('amqplib')
const server = require('http').createServer(app);
const { connectRabbitMQ, publishMessage, consumeMessages } = require('./utils/RabbitMQ/rabbitmq');
const port = process.env.PORT || 3000;
// faceapi.env.monkeyPatch({ Canvas, Image })
dotenv.config();
connectDB();


const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173"],
        // methods: ["GET", "POST"],
        // credentials: true,
    },
});
//Add this before the app.get() block
const users = {}; // Store active users: { userId: [socketId1, socketId2, ...] }

connectRabbitMQ().then(() => {
    consumeMessages(io, users); // Start consuming after connection
});


io.on('connection', (socket) => {
    const userId = socket.handshake.query.id;
    // console.log(userId, "iddd")
    if (!userId) return;

    // Initialize user's socket array if it doesn't exist
    if (!users[userId]) users[userId] = [];

    // Store socket ID for this user
    users[userId].push(socket.id);
    console.log(users, "ds")
    // Broadcast to everyone that this user is online
    socket.broadcast.emit("online", userId);
    // console.log(`User ${userId} connected with socket ${socket.id}`);
    // socket.on("send_message", ({ toUserId, message }) => {
    //     const fromUserId = userId;
    //     const socketIds = users[toUserId];

    //     if (socketIds) {
    //         socketIds.forEach(socketId => {
    //             io.to(socketId).emit("receive_message", {
    //                 from: fromUserId,
    //                 message,
    //                 timestamp: new Date()
    //             });
    //         });
    //     }
    // });
    socket.on('error', function (error) { console.error("error", error); });
    socket.on("send_message", ({ toUserId, message, from }) => {
        const fromUserId = userId;

        const payload = {
            from: fromUserId,
            message,
            sender: from,
            timestamp: new Date()
        };

        const socketIds = users[toUserId];

        if (socketIds && socketIds.length > 0) {
            // ✅ User is online — send immediately via socket
            socketIds.forEach(socketId => {
                io.to(socketId).emit("receive_message", payload);
            });
        } else {
            // ❌ User is offline — publish to RabbitMQ
            publishMessage(toUserId, payload);

        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        // Remove this socket ID from the user's list
        _.remove(users[userId], id => id === socket.id);

        // If no more active sockets for the user
        if (users[userId].length === 0) {
            // Broadcast offline status
            socket.broadcast.emit("offline", userId);
            console.log(`User ${userId} is now offline`);

            // Clean up user entry
            delete users[userId];
        }

        // Not required, but can force socket cleanup
        socket.disconnect(true);
    });
});


// async function LoadModels() {

//     await faceapi.nets.faceRecognitionNet.loadFromDisk(__dirname + "/facemodels")
//     await faceapi.nets.faceLandmark68Net.loadFromDisk(__dirname + "/facemodels")
//     await faceapi.nets.ssdMobilenetv1.loadFromDisk(__dirname + "/facemodels")
// }

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', require('./routes/mainroute'))



app.post("/google-auth", async (req, res) => {
    // console.log(req)
    const { credential, clientId } = req.body;
    // res.status(200).json(req.body);
    console.log(credential, clientId, "credential, clientId")
    try {
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: clientId,
        });
        console.log('first')
        const payload = ticket.getPayload();
        const userid = payload['sub'];
        console.log(payload, "payloda", userid)
        res.status(200).json({ payload });
    } catch (err) {
        // console.log(err)
        res.status(400).json({ err });
    }
});

app.post('/online-users', (req, res) => {
    const clientUsers = req.body; // expects an array of user objects
    if (!Array.isArray(clientUsers)) {
        return res.status(400).json({ error: 'Expected an array of users' });
    }

    const onlineUserIds = clientUsers
        .map(user => user.id)
        .filter(id => users[id]); // Filter only those present in the `users` object

    res.json({ onlineUserIds });
});
// app.get('/', async (req, res) => {
//     try {
//         const users = await User.find();
//         console.log(users)
//         res.send(users)
//     } catch (err) {
//         console.error('Error fetching user data:', err);
//     }
// });

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});