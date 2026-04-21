import { Server } from 'socket.io';

let io;

export function initSocketService(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Adjust for prod
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Admin connected: ${socket.id}`);

    // Listen for admin sending a manual message
    socket.on('admin_reply', async (data) => {
      // data: { leadId, sessionId, message }
      console.log('Admin took over chat:', data);
      
      // Emit back out to anyone listening to this session (like the website widget)
      io.emit(`chat_update_${data.sessionId}`, {
        source: 'admin',
        message: data.message,
        timestamp: new Date()
      });
      
      // TODO: Pause AI logic via session status update here if needed.
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Admin disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function broadcastChatUpdate(sessionId, messagePayload) {
  if (io) {
    // Blast this to the admin panel
    io.emit('new_public_chat_message', { sessionId, ...messagePayload });
    
    // Also blast it back to the active session room
    io.emit(`chat_update_${sessionId}`, messagePayload);
  }
}
