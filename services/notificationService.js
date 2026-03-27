const { v4: uuidv4 } = require('uuid');
const Notification = require('../models/Notification');

// Socket.io instance - set from server.js
let io = null;

function setIO(socketIO) {
  io = socketIO;
}

function getIO() {
  return io;
}

async function createNotification({ user_id, type, title, message, link = '' }) {
  const notification = await Notification.create({
    notification_id: uuidv4(),
    user_id,
    type,
    title,
    message,
    link
  });

  // Push via socket.io if available
  if (io) {
    io.to(`user:${user_id}`).emit('notification', notification.toObject());
  }

  return notification;
}

module.exports = { setIO, getIO, createNotification };
