const { BOARD_FIELDS } = require('./boardConfig');

class GameEngine {
  constructor() {
    this.rooms = {}; // roomId -> gameState
    this.timers = {}; // roomId -> setInterval handle
  }

  createRoom(roomId) {
    if (!this.rooms[roomId]) {
      this.rooms[roomId] = {
        roomId,
        status: 'LOBBY',
        turnIndex: 0,
        turnTimer: 30,
        diceResult: [0, 0],
        doublesCount: 0,
        players: [],
        board: JSON.parse(JSON.stringify(BOARD_FIELDS)),
        messages: [],
        auctions: { active: false },
        pendingUpgrade: null,  // { playerId, fieldId }
        pendingTrade: null,    // { fromId, toId, offerMoney, offerProps, requestMoney, requestProps }
        hasRolled: false,
        announcement: null,
        worldCup: { fieldId: null, multiplier: 1 },
        pendingWorldCup: null,
        settings: { startingMoney: 1500 }
      };
    }
    return this.rooms[roomId];
  }

  getRoom(roomId) {
    return this.rooms[roomId];
  }

  joinRoom(roomId, playerInfo) {
    const room = this.createRoom(roomId);
    if (room.players.length >= 4) throw new Error('Room is full');

    const colors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b'];
    const avatars = ['🦊', '🐱', '🐼', '🐯'];

    const player = {
      id: playerInfo.id,
      name: playerInfo.name,
      money: 1500,
      position: 0,
      laps: 0,
      properties: [],
      inJail: false,
      jailTurns: 0,
      isBankrupt: false,
      color: colors[room.players.length],
      avatar: avatars[room.players.length]
    };

    room.players.push(player);
    return room;
  }

  leaveRoom(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== playerId);
    if (room.players.length === 0) {
      delete this.rooms[roomId];
      if (this.timers[roomId]) clearInterval(this.timers[roomId]);
    }
  }

  startGame(roomId) {
    const room = this.getRoom(roomId);
    if (!room || room.players.length < 2) return false;
    
    // Apply starting money from settings
    room.players.forEach(p => p.money = room.settings.startingMoney);
    
    room.status = 'PLAYING';
    return true;
  }

  rollDice(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'PLAYING') return { error: 'Invalid room state' };

    const currentPlayer = room.players[room.turnIndex];
    if (currentPlayer.id !== playerId) return { error: 'Not your turn' };
    if (currentPlayer.isBankrupt) return { error: 'You are bankrupt' };
    if (room.hasRolled) return { error: 'Już rzucałeś w tej turze' };

    const [die1, die2] = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    const isDouble = die1 === die2;
    room.diceResult = [die1, die2];

    // PASSIVE INCOME FROM UTILITIES
    const utilities = room.board.filter(f => f.ownerId === playerId && f.type === 'UTILITY');
    if (utilities.length > 0) {
      const income = utilities.length === 2 ? 30 : 10;
      currentPlayer.money += income;
      room.messages.push({ system: true, text: `💰 ${currentPlayer.name} otrzymuje $${income} z mediów (Elektrownia/Wodociągi).` });
    }

    if (currentPlayer.inJail) {
      if (isDouble) {
        currentPlayer.inJail = false;
        currentPlayer.jailTurns = 0;
        this.movePlayer(room, currentPlayer, die1 + die2);
        return { room, dice: [die1, die2], double: true, message: 'Wyszedł z więzienia rzucając dublet!' };
      } else {
        currentPlayer.jailTurns++;
        if (currentPlayer.jailTurns >= 3) {
          currentPlayer.money -= 50;
          currentPlayer.inJail = false;
          currentPlayer.jailTurns = 0;
          this.movePlayer(room, currentPlayer, die1 + die2);
          return { room, dice: [die1, die2], double: false, message: 'Zapłacił karę 50$ i wyszedł z więzienia.' };
        }
        room.hasRolled = true;
        this.nextTurn(room);
        return { room, dice: [die1, die2], double: false, message: 'Zostaje w więzieniu.' };
      }
    }

    if (isDouble) {
      room.doublesCount++;
      if (room.doublesCount >= 3) {
        currentPlayer.position = 10;
        currentPlayer.inJail = true;
        room.doublesCount = 0;
        room.hasRolled = true;
        this.nextTurn(room);
        return { room, dice: [die1, die2], double: true, message: 'Poszedł do więzienia za 3 dublety!' };
      }
    } else {
      room.doublesCount = 0;
    }

    this.movePlayer(room, currentPlayer, die1 + die2);

    if (!isDouble) {
      room.hasRolled = true;
    }

    return { room, dice: [die1, die2], double: isDouble };
  }

  movePlayer(room, player, steps) {
    const oldPosition = player.position;
    player.position = (player.position + steps) % 40;

    if (player.position < oldPosition) {
      player.money += 200;
      player.laps++;
      room.messages.push({ system: true, text: `${player.name} przeszedł przez Start i otrzymał $200!` });
    }

    this.handleFieldLanding(room, player);
  }

  getBuildCost(field) {
    const costs = { BROWN: 50, LIGHTBLUE: 50, PINK: 100, ORANGE: 100, RED: 150, YELLOW: 150, GREEN: 200, DARKBLUE: 200 };
    return costs[field.colorGroup] || 100;
  }

  buildHouse(roomId, playerId, propertyId) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    const player = room.players.find(p => p.id === playerId);
    const field = room.board[propertyId];

    if (!field || field.type !== 'PROPERTY') return { error: 'Not a property' };
    if (field.ownerId !== playerId) return { error: 'Not your property' };
    const currentBuildings = field.buildings || 0;
    
    if (currentBuildings >= 5) return { error: 'Maksymalna liczba budynków (hotel)' };
    if (currentBuildings >= 2 && player.laps === 0) return { error: 'Musisz ukończyć pełne okrążenie na planszy, aby budować 3+ domów.' };

    const cost = this.getBuildCost(field);
    if (player.money < cost) return { error: 'Za mało pieniędzy' };

    player.money -= cost;
    field.buildings = (field.buildings || 0) + 1;
    const label = field.buildings === 5 ? 'hotel' : `dom #${field.buildings}`;
    room.messages.push({ system: true, text: `${player.name} wybudował ${label} na ${field.name} za $${cost}` });
    room.pendingUpgrade = null;
    return { room };
  }

  handleFieldLanding(room, player) {
    const field = room.board[player.position];
    if (field.type === 'TAX') {
      player.money -= field.price;
      room.messages.push({ system: true, text: `${player.name} zapłacił podatek $${field.price}` });
      room.announcement = { text: `${player.name} płaci podatek $${field.price}`, type: 'TAX' };
    } else if (field.type === 'GOTOJAIL') {
      player.position = 10;
      player.inJail = true;
      room.messages.push({ system: true, text: `${player.name} idzie do więzienia!` });
      room.announcement = { text: `${player.name} idzie do więzienia!`, type: 'JAIL' };
    } else if (field.type === 'CHANCE' || field.type === 'CHEST') {
      this.handleCard(room, player);
    } else if (field.type === 'PROPERTY' || field.type === 'STATION' || field.type === 'UTILITY') {
      if (field.ownerId && field.ownerId !== player.id) {
        const rent = this.calculateRent(room, field);
        player.money -= rent;
        const owner = room.players.find(p => p.id === field.ownerId);
        if (owner) owner.money += rent;
        room.messages.push({ system: true, text: `${player.name} płaci $${rent} czynszu dla ${owner.name}` });
        room.announcement = { text: `${player.name} płaci $${rent} czynszu dla ${owner.name}`, type: 'RENT' };
      } else if (field.ownerId === player.id && field.type === 'PROPERTY' && (field.buildings || 0) < 5) {
        room.pendingUpgrade = { playerId: player.id, fieldId: field.id };
      }
    } else if (field.type === 'WORLDCUP') {
      if (player.properties.length > 0) {
        room.pendingWorldCup = player.id;
        room.announcement = { text: `${player.name} organizuje MISTRZOSTWA ŚWIATA!`, type: 'JAIL' };
      }
    }
  }

  calculateRent(room, field) {
    let rent = 0;
    if (field.type === 'PROPERTY') {
      rent = field.rentConfig[field.buildings || 0];
    } else if (field.type === 'STATION') {
      const ownerProps = room.board.filter(f => f.ownerId === field.ownerId && f.type === 'STATION');
      rent = field.rentConfig[ownerProps.length - 1] || 25;
    } else if (field.type === 'UTILITY') {
      const ownerProps = room.board.filter(f => f.ownerId === field.ownerId && f.type === 'UTILITY');
      const multiplier = ownerProps.length === 2 ? 10 : 4;
      rent = multiplier * (room.diceResult[0] + room.diceResult[1]);
    }

    if (room.worldCup && room.worldCup.fieldId === field.id) {
      rent = rent * room.worldCup.multiplier;
    }
    return rent;
  }

  buyProperty(roomId, playerId, housesCount = 0) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    const player = room.players.find(p => p.id === playerId);
    const field = room.board[player.position];

    if (!field || field.ownerId || (field.type !== 'PROPERTY' && field.type !== 'STATION' && field.type !== 'UTILITY')) {
      return { error: 'Cannot buy' };
    }

    let totalCost = field.price;
    if (field.type === 'PROPERTY' && housesCount > 0) {
      if (housesCount > 2) return { error: 'Max 2 domy przy zakupie' };
      totalCost += this.getBuildCost(field) * housesCount;
    }

    if (player.money < totalCost) return { error: 'Za mało pieniędzy na zakup z budynkami' };

    player.money -= totalCost;
    field.ownerId = player.id;
    if (field.type === 'PROPERTY') {
      field.buildings = housesCount;
    }
    player.properties.push(field.id);
    
    room.messages.push({ system: true, text: `${player.name} kupuje ${field.name}${housesCount > 0 ? ` z ${housesCount} domami` : ''} za $${totalCost}!` });
    this.checkWinConditions(room);
    return { room };
  }

  checkWinConditions(room) {
    const players = room.players.filter(p => !p.isBankrupt);
    for (const player of players) {
      // 1. Triple Monopoly check
      const colorGroups = {};
      room.board.forEach(f => {
        if (f.type === 'PROPERTY' && f.colorGroup) {
          if (!colorGroups[f.colorGroup]) colorGroups[f.colorGroup] = { owned: 0, total: 0 };
          colorGroups[f.colorGroup].total++;
          if (f.ownerId === player.id) colorGroups[f.colorGroup].owned++;
        }
      });
      const fullMonopolies = Object.values(colorGroups).filter(g => g.owned === g.total).length;

      // 2. Line Monopoly check
      const sides = [
        [1, 3, 6, 8, 9], // Dolna krawędź
        [11, 13, 14, 16, 18, 19], // Lewa
        [21, 23, 24, 26, 27, 29], // Górna
        [31, 32, 34, 37, 39] // Prawa
      ];
      const hasLineMonopoly = sides.some(side => side.every(pos => room.board[pos].ownerId === player.id));

      if (fullMonopolies >= 3 || hasLineMonopoly) {
        const reason = fullMonopolies >= 3 ? "3 MONOPOLE" : "MONOPOL LINIOWY";
        room.status = 'FINISHED';
        room.announcement = { text: `🏆 ${player.name} WYGRYWA: ${reason}!`, type: 'JAIL' };
        room.messages.push({ system: true, text: `KONIEC GRY! ${player.name} osiągnął ${reason}` });
        return;
      }
    }
    
    // Normal bankruptcy check
    if (players.length <= 1) {
      room.status = 'FINISHED';
      if (players[0]) room.announcement = { text: `🏆 ${players[0].name} WYGRYWA!`, type: 'JAIL' };
    }
  }

  declineProperty(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    room.messages.push({ system: true, text: `${room.players[room.turnIndex].name} zrezygnował z zakupu.` });
    this.nextTurn(room);
    return { room };
  }

  hostWorldCup(roomId, playerId, fieldId) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    const player = room.players.find(p => p.id === playerId);
    const field = room.board[fieldId];

    if (field.ownerId !== playerId) return { error: 'To nie Twoje miasto' };
    if (player.money < 200) return { error: 'Za mało pieniędzy ($200)' };

    player.money -= 200;
    if (room.worldCup.fieldId === fieldId) {
      room.worldCup.multiplier += 1;
    } else {
      room.worldCup.fieldId = fieldId;
      room.worldCup.multiplier = 2;
    }

    room.messages.push({ system: true, text: `🏆 Mistrzostwa Świata: ${field.name}! Mnożnik: x${room.worldCup.multiplier}` });
    room.pendingWorldCup = null;
    this.nextTurn(room);
    return { room };
  }

  nextTurn(room) {
    room.doublesCount = 0;
    do {
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
    } while (room.players[room.turnIndex].isBankrupt);
    room.turnTimer = 30;
    room.hasRolled = false;
    room.announcement = null;
  }

  declareBankruptcy(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    const player = room.players.find(p => p.id === playerId);
    if (player.money >= 0 || player.properties.length > 0) return { error: 'Nie możesz zbankrutować' };

    player.isBankrupt = true;
    room.messages.push({ system: true, text: `💀 ${player.name} zbankrutował!` });
    const active = room.players.filter(p => !p.isBankrupt);
    if (active.length <= 1) {
      room.status = 'FINISHED';
    } else {
      this.nextTurn(room);
    }
    return { room };
  }

  payJailBail(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    const player = room.players.find(p => p.id === playerId);
    if (player.money < 200) return { error: 'Za mało pieniędzy' };
    player.money -= 200;
    player.inJail = false;
    player.jailTurns = 0;
    room.messages.push({ system: true, text: `${player.name} wpłacił kaucję i wyszedł!` });
    return { room };
  }

  sellProperty(roomId, playerId, propertyId) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    const player = room.players.find(p => p.id === playerId);
    const field = room.board[propertyId];
    if (field.ownerId !== playerId) return { error: 'Nie Twoje' };

    const cost = this.getBuildCost(field);
    const price = Math.floor(field.price * 0.5) + Math.floor((field.buildings || 0) * cost * 0.5);
    player.money += price;
    field.ownerId = null;
    field.buildings = 0;
    player.properties = player.properties.filter(id => id !== propertyId);
    return { room };
  }

  skipUpgrade(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    room.pendingUpgrade = null;
    return { room };
  }

  handleCard(room, player) {
    const effects = [
      { text: "Błąd bankowy na Twoją korzyść. Pobierz $200", action: (p) => p.money += 200 },
      { text: "Mandat za szybką jazdę $50", action: (p) => p.money -= 50 },
      { text: "Wracasz na Start", action: (p) => p.position = 0 },
      { text: "Idziesz do więzienia", action: (p) => { p.position = 10; p.inJail = true; } }
    ];
    const effect = effects[Math.floor(Math.random() * effects.length)];
    effect.action(player);
    room.messages.push({ system: true, text: `KARTA: ${effect.text}` });
  }

  hostWorldCup(roomId, playerId, propertyId) {
    const room = this.getRoom(roomId);
    if (!room || room.pendingWorldCup !== playerId) return { error: 'Not allowed' };
    
    const player = room.players.find(p => p.id === playerId);
    if (player.money < 200) return { error: 'Za mało pieniędzy na organizację ($200)' };

    player.money -= 200;
    
    if (room.worldCup.fieldId === propertyId) {
      room.worldCup.multiplier += 1;
    } else {
      room.worldCup.fieldId = propertyId;
      room.worldCup.multiplier = 2;
    }

    const field = room.board[propertyId];
    room.messages.push({ system: true, text: `${player.name} organizuje Mistrzostwa Świata w ${field.name}! Mnożnik: x${room.worldCup.multiplier}` });
    room.announcement = { text: `🏆 MISTRZOSTWA: ${field.name} x${room.worldCup.multiplier}`, type: 'JAIL' };
    
    room.pendingWorldCup = null;
    return { room };
  }

  proposeTrade(roomId, fromId, toId, offerMoney, offerProps, requestMoney, requestProps) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    room.pendingTrade = { fromId, toId, offerMoney, offerProps, requestMoney, requestProps };
    return { room };
  }

  respondTrade(roomId, playerId, accept) {
    const room = this.getRoom(roomId);
    if (!room || !room.pendingTrade) return { error: 'No trade' };
    const trade = room.pendingTrade;
    if (trade.toId !== playerId) return { error: 'Not for you' };

    if (accept) {
      const from = room.players.find(p => p.id === trade.fromId);
      const to = room.players.find(p => p.id === trade.toId);

      if (from.money < trade.offerMoney || to.money < trade.requestMoney) return { error: 'Za mało pieniędzy' };

      from.money -= trade.offerMoney;
      to.money += trade.offerMoney;
      to.money -= trade.requestMoney;
      from.money += trade.requestMoney;

      trade.offerProps.forEach(pid => {
        const f = room.board[pid];
        f.ownerId = to.id;
        from.properties = from.properties.filter(id => id !== pid);
        to.properties.push(pid);
      });
      trade.requestProps.forEach(pid => {
        const f = room.board[pid];
        f.ownerId = from.id;
        to.properties = to.properties.filter(id => id !== pid);
        from.properties.push(pid);
      });
      room.messages.push({ system: true, text: `Wymiana między ${from.name} a ${to.name} zakończona sukcesem!` });
      this.checkWinConditions(room);
    }
    room.pendingTrade = null;
    return { room };
  }

  endTurn(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room || room.players[room.turnIndex].id !== playerId) return { error: 'Not your turn' };
    const player = room.players[room.turnIndex];
    if (player.money < 0) return { error: 'Masz dług!' };
    if (room.doublesCount > 0 && !room.hasRolled) return { error: 'Musisz rzucić jeszcze raz' };
    this.nextTurn(room);
    return { room };
  }
}

module.exports = new GameEngine();
