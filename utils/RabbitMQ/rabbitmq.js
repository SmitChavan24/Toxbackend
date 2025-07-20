const amqp = require('amqplib');
const ampurl = process.env.AMP_QUE_URL || 'amqps://dequkjvr:c57TRt_obnCcJ9Rv3huLcEeGJzpG2vFq@kebnekaise.lmq.cloudamqp.com/dequkjvr?heartbeat=60';
let channel, connection;
const QUEUE_NAME = 'chat_messages';


async function connectRabbitMQ() {
    try {
        connection = await amqp.connect(ampurl);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        console.log("RabbitMQ connected and channel initialized");

        // Handle connection errors
        connection.on('error', (err) => {
            connection = null;
            channel = null;
            // setTimeout(startRabbitMQ, 10000);
            console.error('RabbitMQ connection error:', err.message);
        });

        connection.on('close', () => {
            connection = null;
            channel = null;
            console.warn('RabbitMQ connection closed');
        });

        process.on('SIGINT', closeConnection);
        process.on('SIGTERM', closeConnection);
    } catch (err) {
        console.error('Failed to connect to RabbitMQ:', err.message);
        process.exit(1);
    }
}

async function startRabbitMQ() {
    try {
        await connectRabbitMQ();
        console.log("✅ Connected to RabbitMQ");
    } catch (err) {
        console.error("❌ RabbitMQ connection failed, retrying in 5s:", err.message);
        // setTimeout(startRabbitMQ, retryInterval);
    }
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


async function closeConnection() {
    try {
        console.log("Closing RabbitMQ connection...");
        if (channel) await channel.close();
        if (connection) await connection.close();
        process.exit(0);
    } catch (err) {
        console.error('Error closing RabbitMQ connection:', err.message);
        process.exit(1);
    }
}
module.exports = { connectRabbitMQ, publishMessage, consumeMessages, closeConnection };