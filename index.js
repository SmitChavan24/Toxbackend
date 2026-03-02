// const express = require('express')
// const cors = require("cors");
// const dotenv = require('dotenv');
// const connectDB = require('./db/mongodb/connect')
// const User = require('./schema/UserSchema')
// const { Canvas, Image } = require('canvas')
// const canvas = require('canvas')
// const jwt = require('jsonwebtoken')
// const { OAuth2Client } = require('google-auth-library');
// const app = express();
// const _ = require('lodash')
// const { Server } = require("socket.io");
// const server = require('http').createServer(app);
// const port = process.env.PORT || 3000;
// // faceapi.env.monkeyPatch({ Canvas, Image })
// dotenv.config();
// connectDB();

// const JWT_SECRET = process.env.JWT_SECRET || "itsasecretsmit";
// const io = new Server(server, {
//     cors: {
//         origin: ["http://localhost:5173"],
//         // methods: ["GET", "POST"],
//         // credentials: true,
//     },
// });
// //Add this before the app.get() block
// const users = {}; // Store active users: { userId: [socketId1, socketId2, ...] }


// io.on('connection', (socket) => {
//     const userId = socket.handshake.query.id;
//     // console.log(userId, "iddd")
//     if (!userId) return;

//     // Initialize user's socket array if it doesn't exist
//     if (!users[userId]) users[userId] = [];

//     // Store socket ID for this user
//     users[userId].push(socket.id);
//     console.log(users, "ds")
//     // Broadcast to everyone that this user is online
//     socket.broadcast.emit("online", userId);
//     // console.log(`User ${userId} connected with socket ${socket.id}`);
//     // socket.on("send_message", ({ toUserId, message }) => {
//     //     const fromUserId = userId;
//     //     const socketIds = users[toUserId];

//     //     if (socketIds) {
//     //         socketIds.forEach(socketId => {
//     //             io.to(socketId).emit("receive_message", {
//     //                 from: fromUserId,
//     //                 message,
//     //                 timestamp: new Date()
//     //             });
//     //         });
//     //     }
//     // });

//     socket.on('error', function (error) { console.error("error", error); });
//     socket.on("send_message", ({ toUserId, message, from }) => {
//         const fromUserId = userId;

//         const payload = {
//             from: fromUserId,
//             message,
//             sender: from,
//             timestamp: new Date()
//         };

//         const socketIds = users[toUserId];

//         if (socketIds && socketIds.length > 0) {
//             // ✅ User is online — send immediately via socket
//             socketIds.forEach(socketId => {
//                 io.to(socketId).emit("receive_message", payload);
//             });
//         }
//     });

//     // Handle disconnection
//     socket.on('disconnect', () => {
//         // Remove this socket ID from the user's list
//         _.remove(users[userId], id => id === socket.id);

//         // If no more active sockets for the user
//         if (users[userId].length === 0) {
//             // Broadcast offline status
//             socket.broadcast.emit("offline", userId);
//             console.log(`User ${userId} is now offline`);

//             // Clean up user entry
//             delete users[userId];
//         }

//         // Not required, but can force socket cleanup
//         socket.disconnect(true);
//     });
// });


// // async function LoadModels() {

// //     await faceapi.nets.faceRecognitionNet.loadFromDisk(__dirname + "/facemodels")
// //     await faceapi.nets.faceLandmark68Net.loadFromDisk(__dirname + "/facemodels")
// //     await faceapi.nets.ssdMobilenetv1.loadFromDisk(__dirname + "/facemodels")
// // }

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use('/', require('./routes/mainroute'))


// app.post("/google-auth", async (req, res) => {
//     const { credential, clientId } = req.body;

//     try {
//         const client = new OAuth2Client(clientId);
//         const ticket = await client.verifyIdToken({
//             idToken: credential,
//             audience: clientId,
//         });

//         const payload = ticket.getPayload();
//         const { email, name, picture, sub: googleId } = payload;

//         let user = await User.findOne({ email });

//         if (!user) {
//             user = await User.create({
//                 email,
//                 name,
//                 picture,
//                 googleId,
//             });
//         }

//         const token = jwt.sign(
//             { id: user.id, email: user.email },
//             process.env.JWT_SECRET,
//         );

//         res.status(200).json({
//             message: 'Login successful',
//             user,
//             token,
//         });
//     } catch (err) {
//         console.error('Google auth error:', err);
//         res.status(400).json({ message: 'Google authentication failed' });
//     }
// });

// app.post('/online-users', (req, res) => {
//     const clientUsers = req.body; // expects an array of user objects
//     if (!Array.isArray(clientUsers)) {
//         return res.status(400).json({ error: 'Expected an array of users' });
//     }

//     const onlineUserIds = clientUsers
//         .map(user => user.id)
//         .filter(id => users[id]); // Filter only those present in the `users` object

//     res.json({ onlineUserIds });
// });
// // app.get('/', async (req, res) => {~
// //     try {
// //         const users = await User.find();
// //         console.log(users)
// //         res.send(users)
// //     } catch (err) {
// //         console.error('Error fetching user data:', err);
// //     }
// // });

// server.listen(port, () => {
//     console.log(`Server is running on port ${port}`);
// });

const express = require('express')
const cors = require("cors");
const dotenv = require('dotenv');
const connectDB = require('./db/mongodb/connect')
const User = require('./schema/UserSchema')
const { Canvas, Image } = require('canvas')
const canvas = require('canvas')
const jwt = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library');
const app = express();
const _ = require('lodash')
const { Server } = require("socket.io");
const server = require('http').createServer(app);
const port = process.env.PORT || 3000;
dotenv.config();
connectDB();

// ✅ FIX 1: Single JWT_SECRET constant with fallback
const JWT_SECRET = process.env.JWT_SECRET || "itsasecretsmit";

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173"],
    },
});

const users = {}; // Store active users: { userId: [socketId1, socketId2, ...] }

io.on('connection', (socket) => {
    const userId = socket.handshake.query.id;
    if (!userId) return;

    if (!users[userId]) users[userId] = [];
    users[userId].push(socket.id);

    // ✅ FIX 2: Broadcast online ONLY if this is a fresh connection (first tab/device)
    if (users[userId].length === 1) {
        socket.broadcast.emit("online", userId);
        console.log(`User ${userId} is now online`);
    }

    socket.on('error', function (error) { console.error("Socket error:", error); });

    socket.on("send_message", ({ toUserId, message, from }) => {
        const payload = {
            from: userId,
            message,
            sender: from,
            timestamp: new Date()
        };

        const socketIds = users[toUserId];
        if (socketIds && socketIds.length > 0) {
            socketIds.forEach(socketId => {
                io.to(socketId).emit("receive_message", payload);
            });
        }
    });

    socket.on('disconnect', () => {
        _.remove(users[userId], id => id === socket.id);

        if (users[userId].length === 0) {
            socket.broadcast.emit("offline", userId);
            console.log(`User ${userId} is now offline`);
            delete users[userId];
        }
    });
});

app.use(cors());
app.use(express.json({ limit: '10mb' })); // ✅ FIX 3: Increase limit for base64 images/videos
app.use(express.urlencoded({ extended: true }));
app.use('/', require('./routes/mainroute'))

// ✅ FIX 4: Google auth — complete rewrite
app.post("/google-auth", async (req, res) => {
    const { credential, clientId } = req.body;

    try {
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: clientId,
        });

        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                email,
                name,
                picture,
                googleId,
            });
        } else {
            // ✅ Update Google profile info if changed
            let needsUpdate = false;
            if (user.picture !== picture) { user.picture = picture; needsUpdate = true; }
            if (user.name !== name) { user.name = name; needsUpdate = true; }
            if (!user.googleId) { user.googleId = googleId; needsUpdate = true; }
            if (needsUpdate) await user.save();
        }

        // ✅ FIX 5: Use JWT_SECRET constant (won't crash if env var missing)
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
        );

        // ✅ FIX 6: Strip sensitive fields before sending to frontend
        const userObj = user.toObject();
        delete userObj.password;
        delete userObj.__v;

        res.status(200).json({
            message: 'Login successful',
            user: userObj,
            token,
        });
    } catch (err) {
        console.error('Google auth error:', err);
        res.status(400).json({ message: 'Google authentication failed' });
    }
});

// ✅ FIX 7: Handle both id and _id formats
app.post('/online-users', (req, res) => {
    const clientUsers = req.body;
    if (!Array.isArray(clientUsers)) {
        return res.status(400).json({ error: 'Expected an array of users' });
    }

    const onlineUserIds = clientUsers
        .map(user => user.id || user._id)
        .filter(Boolean)
        .filter(id => users[id]);

    res.json({ onlineUserIds });
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});