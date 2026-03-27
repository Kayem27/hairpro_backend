const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { createNotification, getIO } = require('../services/notificationService');

const router = express.Router();

// GET /api/conversations
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.user_id
    }).sort({ created_at: -1 }).lean();

    const enriched = await Promise.all(conversations.map(async (conv) => {
      const otherUserId = conv.participants.find(p => p !== req.user.user_id);
      const otherUser = await User.findOne({ user_id: otherUserId }).lean();
      const lastMessage = await Message.findOne({ conversation_id: conv.conversation_id })
        .sort({ created_at: -1 }).lean();
      const unreadCount = await Message.countDocuments({
        conversation_id: conv.conversation_id,
        sender_id: { $ne: req.user.user_id },
        is_read: false
      });

      return {
        ...conv,
        other_user: otherUser ? {
          user_id: otherUser.user_id,
          first_name: otherUser.first_name,
          last_name: otherUser.last_name
        } : null,
        last_message: lastMessage,
        unread_count: unreadCount
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const conv = await Conversation.findOne({
      conversation_id: req.params.id,
      participants: req.user.user_id
    });
    if (!conv) return res.status(404).json({ error: 'Conversation non trouvée' });

    const messages = await Message.find({ conversation_id: req.params.id })
      .sort({ created_at: 1 }).lean();

    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message requis' });

    const conv = await Conversation.findOne({
      conversation_id: req.params.id,
      participants: req.user.user_id
    });
    if (!conv) return res.status(404).json({ error: 'Conversation non trouvée' });

    const message = await Message.create({
      message_id: uuidv4(),
      conversation_id: req.params.id,
      sender_id: req.user.user_id,
      content: content.trim()
    });

    // Emit real-time message via Socket.io
    const io = getIO();
    if (io) {
      io.to(`conv:${req.params.id}`).emit('new_message', message.toObject());
    }

    // Notify other participant
    const otherUserId = conv.participants.find(p => p !== req.user.user_id);
    if (otherUserId) {
      await createNotification({
        user_id: otherUserId,
        type: 'new_message',
        title: 'Nouveau message',
        message: `${req.user.first_name}: ${content.trim().substring(0, 50)}${content.trim().length > 50 ? '...' : ''}`,
        link: '/dashboard/client/messages'
      });
    }

    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/conversations/:id/read
router.post('/:id/read', auth, async (req, res) => {
  try {
    const conv = await Conversation.findOne({
      conversation_id: req.params.id,
      participants: req.user.user_id
    });
    if (!conv) return res.status(404).json({ error: 'Conversation non trouvée' });

    await Message.updateMany(
      {
        conversation_id: req.params.id,
        sender_id: { $ne: req.user.user_id },
        is_read: false
      },
      { is_read: true }
    );

    res.json({ message: 'Messages marqués comme lus' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
