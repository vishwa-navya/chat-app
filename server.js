const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// Store connected users
const connectedUsers = new Map();
const activeUsers = new Set();

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Voice Call Server Running',
    connectedUsers: connectedUsers.size,
    activeUsers: activeUsers.size,
    timestamp: new Date().toISOString()
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Register user with their nickname
  socket.on('register-user', (userId) => {
    console.log(`👤 User registered: ${userId} (${socket.id})`);
    connectedUsers.set(userId, socket.id);
    activeUsers.add(userId);
    socket.userId = userId;
    
    // Notify about successful registration
    socket.emit('registered', { userId });
    
    // Broadcast user list update
    io.emit('users-update', {
      connectedUsers: Array.from(connectedUsers.keys()),
      activeUsers: Array.from(activeUsers)
    });
  });

  // Handle call initiation
  socket.on('call-user', ({ to }) => {
    console.log(`📞 Call initiated: ${socket.userId} -> ${to}`);
    
    const targetSocketId = connectedUsers.get(to);
    if (targetSocketId) {
      // Notify the target user about incoming call
      io.to(targetSocketId).emit('receive-call', {
        from: socket.userId
      });
      console.log(`📞 Call notification sent to ${to}`);
    } else {
      // Target user is not connected
      socket.emit('call-failed', {
        reason: 'User not available',
        target: to
      });
      console.log(`❌ Call failed: ${to} not connected`);
    }
  });

  // Handle call answer
  socket.on('answer-call', ({ to }) => {
    console.log(`✅ Call answered: ${socket.userId} answered call from ${to}`);
    
    const callerSocketId = connectedUsers.get(to);
    if (callerSocketId) {
      // Notify the caller that call was answered
      io.to(callerSocketId).emit('call-answered', {
        from: socket.userId
      });
      console.log(`✅ Call answer notification sent to ${to}`);
    }
  });

  // Handle call rejection/ending
  socket.on('end-call', ({ to }) => {
    console.log(`📞 Call ended: ${socket.userId} ended call with ${to}`);
    
    const targetSocketId = connectedUsers.get(to);
    if (targetSocketId) {
      // Notify the other user that call ended
      io.to(targetSocketId).emit('call-ended', {
        from: socket.userId
      });
      console.log(`📞 Call end notification sent to ${to}`);
    }
  });

  // WebRTC Signaling - Offer
  socket.on('webrtc-offer', ({ to, offer }) => {
    console.log(`📡 WebRTC offer: ${socket.userId} -> ${to}`);
    
    const targetSocketId = connectedUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc-offer', {
        from: socket.userId,
        offer: offer
      });
    }
  });

  // WebRTC Signaling - Answer
  socket.on('webrtc-answer', ({ to, answer }) => {
    console.log(`📡 WebRTC answer: ${socket.userId} -> ${to}`);
    
    const targetSocketId = connectedUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc-answer', {
        from: socket.userId,
        answer: answer
      });
    }
  });

  // WebRTC Signaling - ICE Candidate
  socket.on('webrtc-ice-candidate', ({ to, candidate }) => {
    console.log(`📡 ICE candidate: ${socket.userId} -> ${to}`);
    
    const targetSocketId = connectedUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc-ice-candidate', {
        from: socket.userId,
        candidate: candidate
      });
    }
  });

  // Handle synchronized hugging
  socket.on('hug-sync-initiate', (hugData) => {
    console.log(`🫂 Hug sync initiated:`, hugData);
    
    // Broadcast synchronized vibration to both users
    const initiatorSocketId = connectedUsers.get(hugData.initiator);
    const responderSocketId = connectedUsers.get(hugData.responder);
    
    if (initiatorSocketId && responderSocketId) {
      // Send synchronized vibration event to both users at the same time
      io.to(initiatorSocketId).emit('hug-sync-vibrate', hugData);
      io.to(responderSocketId).emit('hug-sync-vibrate', hugData);
      
      console.log(`🫂 Synchronized hug vibration sent to both ${hugData.initiator} and ${hugData.responder}`);
    } else {
      console.log(`❌ Hug sync failed: One or both users not connected`);
    }
  });

  // Handle user activity updates
  socket.on('user-activity', ({ isActive }) => {
    if (socket.userId) {
      if (isActive) {
        activeUsers.add(socket.userId);
      } else {
        activeUsers.delete(socket.userId);
      }
      
      // Broadcast updated active users
      io.emit('users-update', {
        connectedUsers: Array.from(connectedUsers.keys()),
        activeUsers: Array.from(activeUsers)
      });
    }
  });

  // Handle message read events
  socket.on('messages-read', ({ messageIds, readBy, senderIds }) => {
    console.log(`📖 Messages read by ${readBy}:`, messageIds);
    
    // Notify all senders that their messages were read
    senderIds.forEach(senderId => {
      const senderSocketId = connectedUsers.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('message-seen-confirmation', {
          messageIds,
          readBy
        });
        console.log(`📖 Notified ${senderId} that messages were read by ${readBy}`);
      }
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    
    if (socket.userId) {
      console.log(`👤 User ${socket.userId} disconnected`);
      connectedUsers.delete(socket.userId);
      activeUsers.delete(socket.userId);
      
      // Broadcast user list update
      io.emit('users-update', {
        connectedUsers: Array.from(connectedUsers.keys()),
        activeUsers: Array.from(activeUsers)
      });
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.userId}:`, error);
  });
});

// Error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Voice Call Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
  console.log(`🌐 CORS enabled for all origins`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});