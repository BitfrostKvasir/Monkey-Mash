// src/network.js
import { io } from 'socket.io-client';

export class NetworkManager {
  constructor() {
    this.socket     = io();
    this.mySocketId = null;
    this.gameState  = null;
    this.roomCode   = null;

    // Callbacks set by caller
    this.onLobbyUpdate    = null;
    this.onRoomJoined     = null;
    this.onJoinError      = null;
    this.onQueueWaiting   = null;
    this.onGameStarting   = null;
    this.onGameState      = null;
    this.onOpenShop       = null;
    this.onUpgradeApplied = null;
    this.onPoolUpdate     = null;
    this.onReviveComplete = null;
    this.onEnemyHit       = null;
    this.onGameOver       = null;
    this.onRoundStart     = null;
    this.onRoundEnd       = null;
    this.onOpenPvpUpgrade = null;
    this.onWaitingUpgrade = null;
    this.onMatchEnd       = null;
    this.onPlayerLeave    = null;
    this.onConnectError   = null;
    this.onKicked         = null;
    this.onGamePaused     = null;
    this.onGameResumed    = null;
    this.onShopReadyUpdate = null;

    this.socket.on('connect', () => { this.mySocketId = this.socket.id; });
    this.socket.on('lobby-update',    d => this.onLobbyUpdate?.(d));
    this.socket.on('room-joined',     d => { this.roomCode = d.code; this.onRoomJoined?.(d); });
    this.socket.on('join-error',      d => this.onJoinError?.(d));
    this.socket.on('queue-waiting',   () => this.onQueueWaiting?.());
    this.socket.on('game-starting',   d => this.onGameStarting?.(d));
    this.socket.on('game-state',      d => { this.gameState = d; this.onGameState?.(d); });
    this.socket.on('open-shop',       d => this.onOpenShop?.(d));
    this.socket.on('upgrade-applied', d => this.onUpgradeApplied?.(d));
    this.socket.on('pool-update',     d => this.onPoolUpdate?.(d));
    this.socket.on('revive-complete', d => this.onReviveComplete?.(d));
    this.socket.on('enemy-hit',       d => this.onEnemyHit?.(d));
    this.socket.on('game-over',       d => this.onGameOver?.(d));
    this.socket.on('round-start',     d => this.onRoundStart?.(d));
    this.socket.on('round-end',       d => this.onRoundEnd?.(d));
    this.socket.on('open-pvp-upgrade',() => this.onOpenPvpUpgrade?.());
    this.socket.on('waiting-for-upgrade', d => this.onWaitingUpgrade?.(d));
    this.socket.on('match-end',       d => this.onMatchEnd?.(d));
    this.socket.on('player-leave',    d => this.onPlayerLeave?.(d));
    this.socket.on('connect_error',   e => this.onConnectError?.(e));
    this.socket.on('kicked',          () => this.onKicked?.());
    this.socket.on('game-paused',      d  => this.onGamePaused?.(d));
    this.socket.on('game-resumed',     () => this.onGameResumed?.());
    this.socket.on('shop-ready-update', d => this.onShopReadyUpdate?.(d));
  }

  // Lobby
  createRoom(playerData)          { this.socket.emit('create-room', playerData); }
  joinRoom(code, playerData)      { this.socket.emit('join-room', { code, ...playerData }); }
  quickPlay(playerData)           { this.socket.emit('quick-play', playerData); }
  setReady(ready)                 { this.socket.emit('set-ready', { ready }); }
  updateCustomisation(data)       { this.socket.emit('update-customisation', data); }
  setMode(mode)                   { this.socket.emit('set-mode', { mode }); }
  setDifficulty(difficulty)       { this.socket.emit('set-difficulty', { difficulty }); }
  startGame()                     { this.socket.emit('start-game'); }

  // In-game
  sendInput(input)                { this.socket.emit('player-input', input); }
  sendReviveStart()               { this.socket.emit('revive-start'); }
  buyUpgrade(upgradeId)           { this.socket.emit('buy-upgrade', { upgradeId }); }
  choosePvpUpgrade(upgradeId)     { this.socket.emit('pvp-upgrade-chosen', { upgradeId }); }
  kickPlayer(targetSocketId)      { this.socket.emit('kick-player', { targetSocketId }); }
  pauseGame()                     { this.socket.emit('pause-game'); }
  resumeGame()                    { this.socket.emit('resume-game'); }
  sendShopReady()                 { this.socket.emit('shop-ready'); }

  destroy() { this.socket.disconnect(); }
}
