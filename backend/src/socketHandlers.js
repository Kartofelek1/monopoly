const gameEngine = require('./gameEngine');

function handleSocketConnection(io, socket) {
  console.log('Nowe połączenie: ', socket.id);

  socket.on('join_room', (data) => {
    const { roomId, playerInfo } = data;
    try {
      playerInfo.id = socket.id;
      const room = gameEngine.joinRoom(roomId, playerInfo);
      socket.join(roomId);
      io.to(roomId).emit('room_update', room);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('start_game', (roomId) => {
    if (gameEngine.startGame(roomId)) {
      const room = gameEngine.getRoom(roomId);
      io.to(roomId).emit('room_update', room);
      io.to(roomId).emit('chat_message', { system: true, text: 'Gra się rozpoczęła!' });
      
      // Start timer
      if (gameEngine.timers[roomId]) clearInterval(gameEngine.timers[roomId]);
      gameEngine.timers[roomId] = setInterval(() => {
        const currentRoom = gameEngine.getRoom(roomId);
        if (!currentRoom) return;

        currentRoom.turnTimer--;
        if (currentRoom.turnTimer <= 0) {
          gameEngine.nextTurn(currentRoom);
          io.to(roomId).emit('room_update', currentRoom);
        } else {
          io.to(roomId).emit('room_update', currentRoom);
        }
      }, 1000);
    }
  });

  socket.on('roll_dice', (roomId) => {
    const result = gameEngine.rollDice(roomId, socket.id);
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      io.to(roomId).emit('dice_rolled', { dice: result.dice, double: result.double, message: result.message });
      io.to(roomId).emit('room_update', result.room);
    }
  });

  socket.on('update_settings', (data) => {
    const { roomId, settings } = data;
    const room = gameEngine.getRoom(roomId);
    if (room && room.status === 'LOBBY') {
      room.settings = { ...room.settings, ...settings };
      io.to(roomId).emit('room_update', room);
    }
  });

  socket.on('buy_property', (data) => {
    const { roomId, housesCount = 0 } = data;
    const result = gameEngine.buyProperty(roomId, socket.id, housesCount);
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      io.to(roomId).emit('room_update', result.room);
    }
  });

  socket.on('decline_property', (roomId) => {
    const room = gameEngine.getRoom(roomId);
    if (room) {
      room.messages.push({ system: true, text: `${socket.id} pominął zakup.` });
      io.to(roomId).emit('room_update', room);
    }
  });



  socket.on('build_house', (data) => {
    const { roomId, propertyId } = data;
    const result = gameEngine.buildHouse(roomId, socket.id, propertyId);
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      io.to(roomId).emit('room_update', result.room);
    }
  });

  socket.on('end_turn', (roomId) => {
    const result = gameEngine.endTurn(roomId, socket.id);
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      io.to(roomId).emit('room_update', result.room);
    }
  });

  socket.on('send_message', (data) => {
    const { roomId, text, sender } = data;
    const room = gameEngine.getRoom(roomId);
    if (room) {
      const msg = { system: false, text, sender, time: new Date().toLocaleTimeString() };
      room.messages.push(msg);
      io.to(roomId).emit('chat_message', msg);
    }
  });

  socket.on('skip_upgrade', (roomId) => {
    const result = gameEngine.skipUpgrade(roomId, socket.id);
    if (!result.error) io.to(roomId).emit('room_update', result.room);
  });

  socket.on('propose_trade', (data) => {
    const { roomId, toId, offerMoney, offerProps, requestMoney, requestProps } = data;
    const result = gameEngine.proposeTrade(roomId, socket.id, toId, offerMoney, offerProps, requestMoney, requestProps);
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      io.to(roomId).emit('room_update', result.room);
    }
  });

  socket.on('respond_trade', (data) => {
    const { roomId, accept } = data;
    const result = gameEngine.respondTrade(roomId, socket.id, accept);
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      io.to(roomId).emit('room_update', result.room);
    }
  });

  socket.on('pay_jail_bail', (roomId) => {
    const result = gameEngine.payJailBail(roomId, socket.id);
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      io.to(roomId).emit('room_update', result.room);
    }
  });

  socket.on('sell_property', (data) => {
    const { roomId, propertyId } = data;
    const result = gameEngine.sellProperty(roomId, socket.id, propertyId);
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      io.to(roomId).emit('room_update', result.room);
    }
  });  socket.on('host_world_cup', (data) => {
    const { roomId, propertyId } = data;
    const result = gameEngine.hostWorldCup(roomId, socket.id, propertyId);
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      io.to(roomId).emit('room_update', result.room);
    }
  });
  socket.on('declare_bankruptcy', (roomId) => {
    const result = gameEngine.declareBankruptcy(roomId, socket.id);
    if (result.error) {
      socket.emit('error', result.error);
    } else {
      io.to(roomId).emit('room_update', result.room);
    }
  });

  socket.on('disconnect', () => {
    console.log('Odłączono: ', socket.id);
    // Find room where this player is and leave
    for (const roomId in gameEngine.rooms) {
      const room = gameEngine.rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        gameEngine.leaveRoom(roomId, socket.id);
        io.to(roomId).emit('room_update', gameEngine.rooms[roomId] || { status: 'DELETED' });
      }
    }
  });
}

module.exports = { handleSocketConnection };
