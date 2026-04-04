// server/room-manager.js
const rooms = new Map();
const matchmakingQueue = []; // [{ socketId, playerData }]

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function createRoom(hostSocketId, playerData, isPrivate = true) {
  let id = generateCode();
  while (rooms.has(id)) id = generateCode();
  const room = {
    id,
    isPrivate,
    mode: 'coop',
    difficulty: 'normal',
    phase: 'lobby',
    players: [{
      socketId: hostSocketId,
      isHost: true,
      ready: false,
      ...playerData,
    }],
    game: null,
    _cleanupTimer: null,
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id) {
  return rooms.get(id) || null;
}

export function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.socketId === socketId)) return room;
  }
  return null;
}

export function addPlayerToRoom(room, socketId, playerData) {
  if (room.players.length >= 4) return false;
  room.players.push({ socketId, isHost: false, ready: false, ...playerData });
  clearTimeout(room._cleanupTimer);
  room._cleanupTimer = null;
  return true;
}

export function removePlayerFromRoom(socketId) {
  const room = getRoomBySocket(socketId);
  if (!room) return null;
  room.players = room.players.filter(p => p.socketId !== socketId);
  if (room.players.length === 0) {
    scheduleCleanup(room);
  } else if (!room.players.some(p => p.isHost)) {
    room.players[0].isHost = true; // promote next player
  }
  return room;
}

export function scheduleCleanup(room) {
  room._cleanupTimer = setTimeout(() => rooms.delete(room.id), 30_000);
}

export function addToQueue(socketId, playerData) {
  matchmakingQueue.push({ socketId, playerData });
}

export function removeFromQueue(socketId) {
  const idx = matchmakingQueue.findIndex(e => e.socketId === socketId);
  if (idx !== -1) matchmakingQueue.splice(idx, 1);
}

export function tryMatchmake() {
  if (matchmakingQueue.length < 2) return null;
  const [a, b] = matchmakingQueue.splice(0, 2);
  const room = createRoom(a.socketId, a.playerData, false);
  addPlayerToRoom(room, b.socketId, b.playerData);
  return room;
}
