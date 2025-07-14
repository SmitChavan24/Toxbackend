const amqp = require('amqplib');
const ampurl = process.env.AMP_QUE_URL;
let channel, connection;
const QUEUE_NAME = 'chat_messages';

async function connectRabbitMQ() {
    connection = await amqp.connect(ampurl); // or your remote RabbitMQ URI
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
}

function publishMessage(toUserId, messagePayload) {
    const message = JSON.stringify({ toUserId, ...messagePayload });
    channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });
}

function consumeMessages(io, users) {
    channel.consume(QUEUE_NAME, (msg) => {
        if (msg !== null) {
            const { toUserId, from, message, timestamp } = JSON.parse(msg.content.toString());

            const socketIds = users[toUserId];
            if (socketIds && socketIds.length > 0) {
                socketIds.forEach(socketId => {
                    io.to(socketId).emit('receive_message', { from, message, timestamp });
                });

                // Message delivered, so acknowledge
                channel.ack(msg);
            } else {
                // User is still offline, requeue
                channel.nack(msg, false, true);
            }
        }
    });
}

module.exports = { connectRabbitMQ, publishMessage, consumeMessages };