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

const JWT_SECRET = process.env.JWT_SECRET || "itsasecretsmit";

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173"],
    },
});

// ── Connection tracking ──
const users = {};     // All connections: { userId: [socketId1, socketId2, ...] }
const agents = {};    // Agent connections: { agentId: [socketId1, ...] }
const customers = {}; // Customer connections: { customerId: { socketIds, name, email } }

io.on('connection', (socket) => {
    const userId = socket.handshake.query.id;
    const isCustomer = socket.handshake.query.isCustomer === 'true';
    const customerName = socket.handshake.query.name || 'Customer';
    const customerEmail = socket.handshake.query.email || '';
    if (!userId) return;

    if (!users[userId]) users[userId] = [];
    users[userId].push(socket.id);

    if (isCustomer) {
        // ── Customer connected via widget ──
        customers[userId] = { socketIds: users[userId], name: customerName, email: customerEmail };
        console.log(`Customer ${customerName} (${userId}) connected`);

        // Notify all online agents about new customer
        Object.keys(agents).forEach(agentId => {
            const agentSockets = agents[agentId];
            if (agentSockets) {
                agentSockets.forEach(sid => {
                    io.to(sid).emit("online", userId);
                });
            }
        });
    } else {
        // ── Agent connected ──
        agents[userId] = users[userId];
        if (users[userId].length === 1) {
            socket.broadcast.emit("online", userId);
            console.log(`Agent ${userId} is now online`);
        }
    }

    socket.on('error', function (error) { console.error("Socket error:", error); });

    socket.on("send_message", async ({ toUserId, message, from }) => {
        const isCustomerSender = !!customers[userId];

        // ── Customer sends with no target → broadcast to ALL online agents ──
        if (isCustomerSender && !toUserId) {
            const payload = {
                from: userId,
                message,
                sender: {
                    id: userId,
                    name: customers[userId]?.name,
                    email: customers[userId]?.email,
                    isCustomer: true,
                },
                timestamp: new Date()
            };

            Object.keys(agents).forEach(agentId => {
                const agentSockets = agents[agentId];
                if (agentSockets) {
                    agentSockets.forEach(sid => {
                        io.to(sid).emit("receive_message", payload);
                        // Also trigger auto-reply check for customer messages
                        io.to(sid).emit("check_auto_reply", {
                            senderId: userId,
                            senderInfo: {
                                id: userId,
                                name: customers[userId]?.name,
                                email: customers[userId]?.email,
                                isCustomer: true,
                            },
                            message: message,
                        });
                    });
                }
            });
            return;
        }

        // ── Normal agent-to-customer or agent-to-agent messaging ──
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

        // Check if target user has auto-reply enabled
        if (socketIds && socketIds.length > 0) {
            socketIds.forEach(socketId => {
                io.to(socketId).emit("check_auto_reply", {
                    senderId: userId,
                    senderInfo: from,
                    message: message,
                });
            });
        }
    });

    socket.on('disconnect', () => {
        _.remove(users[userId], id => id === socket.id);

        if (users[userId].length === 0) {
            socket.broadcast.emit("offline", userId);

            // Clean up from the right tracking object
            if (customers[userId]) {
                console.log(`Customer ${customers[userId].name} disconnected`);
                delete customers[userId];
            } else if (agents[userId]) {
                console.log(`Agent ${userId} is now offline`);
                delete agents[userId];
            }

            delete users[userId];
        }
    });
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/', require('./routes/mainroute'))
app.use('/', require('./routes/airoute'));

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
                id: googleId,
                email,
                name,
                picture,
                googleId,
                createddate: new Date().toISOString(),
            });
        } else {
            let needsUpdate = false;
            if (user.picture !== picture) { user.picture = picture; needsUpdate = true; }
            if (user.name !== name) { user.name = name; needsUpdate = true; }
            if (!user.googleId) { user.googleId = googleId; needsUpdate = true; }
            if (needsUpdate) await user.save();
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
        );

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
// dotenv.config();
// connectDB();

// // ✅ FIX 1: Single JWT_SECRET constant with fallback
// const JWT_SECRET = process.env.JWT_SECRET || "itsasecretsmit";

// const io = new Server(server, {
//     cors: {
//         origin: ["http://localhost:5173"],
//     },
// });

// const users = {}; // Store active users: { userId: [socketId1, socketId2, ...] }

// io.on('connection', (socket) => {
//     const userId = socket.handshake.query.id;
//     if (!userId) return;

//     if (!users[userId]) users[userId] = [];
//     users[userId].push(socket.id);

//     // ✅ FIX 2: Broadcast online ONLY if this is a fresh connection (first tab/device)
//     if (users[userId].length === 1) {
//         socket.broadcast.emit("online", userId);
//         console.log(`User ${userId} is now online`);
//     }

//     socket.on('error', function (error) { console.error("Socket error:", error); });

//     // socket.on("send_message", ({ toUserId, message, from }) => {
//     //     const payload = {
//     //         from: userId,
//     //         message,
//     //         sender: from,
//     //         timestamp: new Date()
//     //     };

//     //     const socketIds = users[toUserId];
//     //     if (socketIds && socketIds.length > 0) {
//     //         socketIds.forEach(socketId => {
//     //             io.to(socketId).emit("receive_message", payload);
//     //         });
//     //     }
//     // });
//     // Replace your existing send_message handler with this:

//     socket.on("send_message", async ({ toUserId, message, from }) => {
//         const payload = {
//             from: userId,
//             message,
//             sender: from,
//             timestamp: new Date()
//         };

//         const socketIds = users[toUserId];

//         if (socketIds && socketIds.length > 0) {
//             // User is online — send immediately
//             socketIds.forEach(socketId => {
//                 io.to(socketId).emit("receive_message", payload);
//             });
//         }

//         // ✅ Check if target user has auto-reply enabled
//         // The auto-reply state is managed client-side
//         // We emit a special event so the TARGET client can decide
//         if (socketIds && socketIds.length > 0) {
//             socketIds.forEach(socketId => {
//                 io.to(socketId).emit("check_auto_reply", {
//                     senderId: userId,
//                     senderInfo: from,
//                     message: message,
//                 });
//             });
//         }
//     });
//     socket.on('disconnect', () => {
//         _.remove(users[userId], id => id === socket.id);

//         if (users[userId].length === 0) {
//             socket.broadcast.emit("offline", userId);
//             console.log(`User ${userId} is now offline`);
//             delete users[userId];
//         }
//     });
// });

// app.use(cors());
// app.use(express.json({ limit: '10mb' })); // ✅ FIX 3: Increase limit for base64 images/videos
// app.use(express.urlencoded({ extended: true }));
// app.use('/', require('./routes/mainroute'))
// app.use('/', require('./routes/airoute'));

// // ✅ FIX 4: Google auth — complete rewrite
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
//                 id: googleId,
//                 email,
//                 name,
//                 picture,
//                 googleId,
//                 createddate: new Date().toISOString(),
//             });
//         } else {
//             // ✅ Update Google profile info if changed
//             let needsUpdate = false;
//             if (user.picture !== picture) { user.picture = picture; needsUpdate = true; }
//             if (user.name !== name) { user.name = name; needsUpdate = true; }
//             if (!user.googleId) { user.googleId = googleId; needsUpdate = true; }
//             if (needsUpdate) await user.save();
//         }

//         // ✅ FIX 5: Use JWT_SECRET constant (won't crash if env var missing)
//         const token = jwt.sign(
//             { id: user.id, email: user.email },
//             JWT_SECRET,
//         );

//         // ✅ FIX 6: Strip sensitive fields before sending to frontend
//         const userObj = user.toObject();
//         delete userObj.password;
//         delete userObj.__v;

//         res.status(200).json({
//             message: 'Login successful',
//             user: userObj,
//             token,
//         });
//     } catch (err) {
//         console.error('Google auth error:', err);
//         res.status(400).json({ message: 'Google authentication failed' });
//     }
// });

// // ✅ FIX 7: Handle both id and _id formats
// app.post('/online-users', (req, res) => {
//     const clientUsers = req.body;
//     if (!Array.isArray(clientUsers)) {
//         return res.status(400).json({ error: 'Expected an array of users' });
//     }

//     const onlineUserIds = clientUsers
//         .map(user => user.id || user._id)
//         .filter(Boolean)
//         .filter(id => users[id]);

//     res.json({ onlineUserIds });
// });

// server.listen(port, () => {
//     console.log(`Server is running on port ${port}`);
// });