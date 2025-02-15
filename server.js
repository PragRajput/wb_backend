// server.js
const express = require('express');
const mongoose = require("mongoose");
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Explicitly configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",  // Allow requests only from this origin
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Enable CORS for Express (although Socket.IO will handle this)
app.use(cors({ origin: '*' }));  // This might be redundant, but it shouldn't harm
app.use(express.json());


// MongoDB Connection
mongoose.connect('mongodb+srv://PragRajput:Prag22@cluster0.fvrrcdf.mongodb.net/Whiteboard', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Whiteboard Schema
const whiteboardSchema = new mongoose.Schema({
  roomId: String,
  data: Array,
});
const Whiteboard = mongoose.model('Whiteboard', whiteboardSchema);

// Load Whiteboard Data
app.get('/getAllWhiteboardRooms', async (req, res) => {
  try {
    const session = await Whiteboard.find({}, { roomId: 1 });
    res.status(200).send(session ? session : []);
  } catch (error) {
    res.status(500).send({ error: 'Error loading whiteboard' });
  }
});

// Load Whiteboard Data
app.get('/getWhiteboard/:roomId', async (req, res) => {
  const roomId = req.params.roomId;
  try {
    const session = await Whiteboard.findOne({ roomId });
    res.status(200).send(session ? session.data : []);
  } catch (error) {
    res.status(500).send({ error: 'Error loading whiteboard' });
  }
});

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join', async (roomId) => {
    console.log(`Client joining room: ${roomId}`);
    socket.join(roomId);

    try {
      let session = await Whiteboard.findOne({ roomId });
      console.log(session);

      if (!session) {
        // Create a new session if it doesn't exist
        session = new Whiteboard({ roomId, data: [] });
        await session.save();
      }
      // Send existing (or empty) strokes to the joining user
      socket.emit('whiteboardData', { strokes: session.data });

    } catch (error) {
      console.error('Error loading whiteboard:', error);
      socket.emit('error', { message: 'Error loading whiteboard' });
    }
  });
  // Broadcast drawing data to the room when someone draws
  socket.on('draw', async (data) => {
    const { roomId, strokeData } = data;

    // Broadcast drawing data to all users in the room
    socket.to(roomId).emit('draw', { strokeData });
    console.log(`Drawing broadcasted to room: ${roomId}`);

    try {
      // Directly update MongoDB: Append new stroke to the `data` array
      await Whiteboard.findOneAndUpdate(
        { roomId },
        { $push: { data: strokeData } }, // Add new stroke to existing data
        { upsert: true, new: true }
      );

      console.log(`Whiteboard data auto-saved for room ${roomId}`);
    } catch (error) {
      console.error('Error saving whiteboard data', error);
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
