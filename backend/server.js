const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { handleSocketConnection } = require('./src/socketHandlers');

const app = express();
// CORS dla Expressa
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // Na produkcji warto tu wpisać adres Twojego frontendu, 
    // ale '*' zadziała bez problemu na start
    origin: '*', 
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  handleSocketConnection(io, socket);
});

// Render i inne serwery wymagają PORT z env
const PORT = process.env.PORT || 3001;

// WAŻNE: Dodajemy "0.0.0.0", aby serwer akceptował połączenia z zewnątrz
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Serwer gry nasłuchuje na porcie ${PORT}`);
});