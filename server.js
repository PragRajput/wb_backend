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
    // origin: "http://192.168.0.45:3000",  // Allow requests only from this origin
    origin: "*",  // Allow requests only from this origin
    methods: ["GET", "POST"],        // Allow GET and POST methods
    allowedHeaders: ["my-custom-header"], // You can add custom headers here
    credentials: true
  }
});

// Enable CORS for Express (although Socket.IO will handle this)
app.use(cors({ origin: '*' }));  // This might be redundant, but it shouldn't harm
app.use(express.json());

// Serve static files (optional for production)
app.use(express.static('public'));


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

// Save Whiteboard Data
app.post('/saveWhiteboard', async (req, res) => {
  console.log(req.body);

  const { roomId, data } = req.body;
  try {
    let session = await Whiteboard.findOne({ roomId });
    if (session) {
      session.data = data;
      await session.save();
    } else {
      const newSession = new Whiteboard({ roomId, data });
      await newSession.save();
    }
    res.status(200).send({ message: 'Whiteboard saved successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Error saving whiteboard' });
  }
});

// Load Whiteboard Data
app.get('/getAllWhiteboardRooms', async (req, res) => {
  try {
    const session = await Whiteboard.find({}, { roomId: 1 });
    console.log("session", session);

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

// Store the active whiteboard sessions in memory
let activeRooms = {};  // Key: roomId, Value: current drawing state

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log('New client connected');

  // Handle room joining and sending the existing whiteboard data
  socket.on('join', async (roomId) => {
    console.log(`Client joining room: ${roomId}`);
    socket.join(roomId);

    // Check if the room has an active session in memory
    if (activeRooms[roomId]) {
      // Send the existing strokes to the client from memory (no DB call)
      socket.emit('whiteboardData', { strokes: activeRooms[roomId] });
    } else {
      // If no active session in memory, fetch from the DB (only the first time the room is accessed)
      try {
        const session = await Whiteboard.findOne({ roomId });
        if (session) {
          // Store the session in memory and send it to the client
          activeRooms[roomId] = session.data;
          socket.emit('whiteboardData', { strokes: session.data });
        } else {
          // If no data exists, send an empty strokes array
          socket.emit('whiteboardData', { strokes: [] });
        }
      } catch (error) {
        console.error('Error loading whiteboard:', error);
        socket.emit('error', { message: 'Error loading whiteboard' });
      }
    }
  });

  // Broadcast drawing data to the room when someone draws
  socket.on('draw', (data) => {
    const { roomId, strokeData } = data;
    socket.to(roomId).emit('draw', { strokeData });  // Broadcast to everyone in the same room
    console.log('Drawing broadcasted to room', roomId);

    // Update the in-memory drawing state for the room
    if (activeRooms[roomId]) {
      activeRooms[roomId].push(strokeData);  // Append the new stroke data to the current drawing state
    } else {
      activeRooms[roomId] = [strokeData];  // If the room doesn't have data yet, initialize it
    }
  });

  // Save whiteboard data when the user clicks "Save"
  socket.on('saveWhiteboard', async (data) => {
    const { roomId, strokes } = data;

    try {
      let session = await Whiteboard.findOne({ roomId });

      if (session) {
        session.data = strokes;  // Replace old strokes with the new ones
        await session.save();
      } else {
        const newSession = new Whiteboard({ roomId, data: strokes });
        await newSession.save();
      }

      // Update the in-memory active session as well
      activeRooms[roomId] = strokes;

      console.log('Whiteboard data saved successfully');
    } catch (error) {
      console.error('Error saving whiteboard data', error);
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// // Socket.io connection logic
// io.on('connection', (socket) => {
//   console.log('New client connected');

//   // Handle room joining and sending the existing whiteboard data
//   socket.on('join', async (roomId) => {
//     console.log(`Client joining room: ${roomId}`);
//     socket.join(roomId);

//     // Fetch the existing strokes for this room
//     try {
//       const session = await Whiteboard.findOne({ roomId });
//       if (session) {
//         // Send the existing strokes to the client that joined
//         socket.emit('whiteboardData', { strokes: session.data });
//       } else {
//         // If no data exists, send an empty strokes array
//         socket.emit('whiteboardData', { strokes: [] });
//       }
//     } catch (error) {
//       console.error('Error loading whiteboard:', error);
//       socket.emit('error', { message: 'Error loading whiteboard' });
//     }
//   });

//   // Broadcast drawing data to the room when someone draws
//   socket.on('draw', (data) => {
//     const { roomId, strokeData } = data;
//     socket.to(roomId).emit('draw', { strokeData });  // Broadcast to everyone in the same room
//     console.log('Drawing broadcasted to room', roomId);
//   });

//   // Save whiteboard data when the user clicks "Save"
//   socket.on('saveWhiteboard', async (data) => {
//     const { roomId, strokes } = data;

//     try {
//       let session = await Whiteboard.findOne({ roomId });

//       if (session) {
//         session.data = strokes;  // Replace old strokes with the new ones
//         await session.save();
//       } else {
//         const newSession = new Whiteboard({ roomId, data: strokes });
//         await newSession.save();
//       }

//       console.log('Whiteboard data saved successfully');
//     } catch (error) {
//       console.error('Error saving whiteboard data', error);
//     }
//   });

//   socket.on('disconnect', () => {
//     console.log('Client disconnected');
//   });
// });


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
