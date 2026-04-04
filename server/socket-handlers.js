// server/socket-handlers.js
import {
  createRoom, getRoom, getRoomBySocket, addPlayerToRoom,
  removePlayerFromRoom, addToQueue, removeFromQueue, tryMatchmake,
} from './room-manager.js';

function lobbyState(room) {
  return {
    id: room.id,
    mode: room.mode,
    difficulty: room.difficulty,
    players: room.players.map(p => ({
      socketId: p.socketId,
      name: p.name,
      playerClass: p.playerClass,
      colour: p.colour,
      hat: p.hat,
      ready: p.ready,
      isHost: p.isHost,
    })),
  };
}

function broadcastLobby(io, room) {
  io.to(room.id).emit('lobby-update', lobbyState(room));
}

export function handleSocket(io, socket) {
  // ── Lobby events ──────────────────────────────────────────────

  socket.on('create-room', (playerData) => {
    const room = createRoom(socket.id, playerData, true);
    socket.join(room.id);
    socket.emit('room-joined', { code: room.id });
    broadcastLobby(io, room);
  });

  socket.on('join-room', ({ code, ...playerData }) => {
    const room = getRoom(code.toUpperCase());
    if (!room) { socket.emit('join-error', 'Room not found'); return; }
    if (room.phase !== 'lobby') { socket.emit('join-error', 'Game already started'); return; }
    if (!addPlayerToRoom(room, socket.id, playerData)) {
      socket.emit('join-error', 'Room is full'); return;
    }
    socket.join(room.id);
    socket.emit('room-joined', { code: room.id });
    broadcastLobby(io, room);
  });

  socket.on('quick-play', (playerData) => {
    addToQueue(socket.id, playerData);
    const room = tryMatchmake();
    if (room) {
      for (const p of room.players) {
        const s = io.sockets.sockets.get(p.socketId);
        if (s) s.join(room.id);
      }
      io.to(room.id).emit('room-joined', { code: room.id });
      broadcastLobby(io, room);
    } else {
      socket.emit('queue-waiting');
    }
  });

  socket.on('set-ready', ({ ready }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) player.ready = ready;
    broadcastLobby(io, room);
  });

  socket.on('update-customisation', ({ playerClass, colour, hat, name }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      if (playerClass) player.playerClass = playerClass;
      if (colour !== undefined) player.colour = colour;
      if (hat) player.hat = hat;
      if (name) player.name = name;
    }
    broadcastLobby(io, room);
  });

  socket.on('set-mode', ({ mode }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) return;
    room.mode = mode;
    broadcastLobby(io, room);
  });

  socket.on('set-difficulty', ({ difficulty }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) return;
    room.difficulty = difficulty;
    broadcastLobby(io, room);
  });

  socket.on('start-game', async () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player?.isHost) return;
    if (room.players.length < 2) return;

    room.phase = 'game';
    io.to(room.id).emit('game-starting', { mode: room.mode, difficulty: room.difficulty });

    if (room.mode === 'coop') {
      const { ServerGame } = await import('./server-game.js');
      room.game = new ServerGame(io, room);
      room.game.start();
    } else {
      const { PvPGame } = await import('./server-pvp.js');
      room.game = new PvPGame(io, room);
      room.game.start();
    }
  });

  // ── In-game events ────────────────────────────────────────────

  socket.on('player-input', (input) => {
    const room = getRoomBySocket(socket.id);
    if (!room?.game) return;
    room.game.applyInput(socket.id, input);
  });

  socket.on('revive-start', () => {
    const room = getRoomBySocket(socket.id);
    if (!room?.game?.startRevive) return;
    room.game.startRevive(socket.id);
  });

  socket.on('buy-upgrade', ({ upgradeId }) => {
    const room = getRoomBySocket(socket.id);
    if (!room?.game?.buyUpgrade) return;
    room.game.buyUpgrade(socket.id, upgradeId);
  });

  socket.on('pvp-upgrade-chosen', ({ upgradeId }) => {
    const room = getRoomBySocket(socket.id);
    if (!room?.game?.chooseUpgrade) return;
    room.game.chooseUpgrade(socket.id, upgradeId);
  });

  // ── Disconnect ────────────────────────────────────────────────

  socket.on('disconnect', () => {
    removeFromQueue(socket.id);
    const room = removePlayerFromRoom(socket.id);
    if (!room) return;
    if (room.game) room.game.removePlayer(socket.id);
    if (room.players.length > 0) {
      broadcastLobby(io, room);
      io.to(room.id).emit('player-leave', { socketId: socket.id });
    }
  });
}
