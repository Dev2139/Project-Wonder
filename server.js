const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust this based on your frontend URL for security
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle joining a room
  socket.on('joinRoom', ({ room }) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room ${room}`);
  });

  // Handle code changes
  socket.on('codeChange', ({ room, code }) => {
    socket.to(room).emit('codeUpdate', code);
  });

  // Handle output updates
  socket.on('outputUpdate', ({ room, output, isRunning }) => {
    socket.to(room).emit('outputUpdate', { output, isRunning });
  });

  // Handle run code
  socket.on('runCode', ({ room }) => {
    socket.to(room).emit('runCode');
  });

  // Handle chat messages
  socket.on('chatMessage', ({ room, sender, message, timestamp }) => {
    const chatMessage = { sender, message, timestamp };
    io.to(room).emit('chatMessage', chatMessage); // Broadcast to all clients in the room, including sender
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

server.listen(5000, () => {
  console.log('Socket.IO server running on port 5000');
});