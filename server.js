// server.js
const express = require('express');
const mongoose = require("mongoose");
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({ origin: '*' }));
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

// Get Whiteboard Data
app.get('/getAllWhiteboardRooms', async (req, res) => {
  try {
    const session = await Whiteboard.find({}, { roomId: 1 });
    res.status(200).send(session ? session : []);
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
        session = new Whiteboard({ roomId, data: [] });
        await session.save();
      }
      socket.emit('whiteboardData', { strokes: session.data });

    } catch (error) {
      console.error('Error loading whiteboard:', error);
      socket.emit('error', { message: 'Error loading whiteboard' });
    }
  });

  socket.on('draw', async (data) => {
    const { roomId, strokeData } = data;

    socket.to(roomId).emit('draw', { strokeData });
    console.log(`Drawing broadcasted to room: ${roomId}`);

    try {

      await Whiteboard.findOneAndUpdate(
        { roomId },
        { $push: { data: strokeData } },
        { upsert: true, new: true }
      );

      console.log(`Whiteboard data auto-saved for room ${roomId}`);
    } catch (error) {
      console.error('Error saving whiteboard data', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
