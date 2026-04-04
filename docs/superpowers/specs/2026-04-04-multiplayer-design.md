# Multiplayer Design — Monkey Mash

**Date:** 2026-04-04  
**Branch:** feature/multiplayer  
**Status:** Approved

---

## Overview

Add online multiplayer to Monkey Mash supporting up to 4 players across two modes: Co-op (fight waves together) and PvP (last monkey standing). Built on Socket.io over the existing Express server. Hosted free on Render.

---

## Architecture

### Networking approach: Socket.io (server-authoritative)

The server runs the authoritative game loop. Clients send only inputs; the server processes them, updates game state, and broadcasts back to all players 20×/second.

```
Browser (P1) ──inputs──▶  Express + Socket.io  ◀──inputs── Browser (P2)
             ◀──state───        │             ───state──▶
                                │
                          Authoritative game loop
                          (enemies, damage, bananas, collisions)
```

### New files
- `src/server-game.js` — server-side game loop for multiplayer rooms
- `src/network.js` — client-side Socket.io wrapper, feeds state into renderer

### Unchanged
- `game.js` — solo mode untouched
- `server.js` — gains Socket.io attachment only

---

## Room & Lobby System

### Room creation
- Main menu gains a **Multiplayer** button alongside Solo and Tutorial
- **Quick Play** — joins a public matchmaking queue; server pairs 2+ waiting players into a room automatically
- **Create Room** — generates a private 5-character code (e.g. `AB3X9`) for friends
- **Join Room** — enter a code to join a private room

### Lobby UI (list layout)
- Each player shown as a row: monkey preview, class, colour, hat, ready state
- Click your own row to open inline customiser
- Host controls: difficulty dropdown, Co-op/PvP mode toggle, Start Game button (enabled when 2+ players ready)
- All players see the mode and difficulty the host has selected

### Server room model
```js
{
  id: 'AB3X9',
  mode: 'coop' | 'pvp',
  difficulty: 'easy' | 'normal' | 'hard',
  phase: 'lobby' | 'game' | 'results',
  players: [{ id, name, class, colour, hat, ready, isHost }]
}
```
- Rooms stored in memory — no database
- Empty rooms cleaned up after 30 seconds
- If host disconnects, next player in list becomes host

---

## Co-op Mode

### Setup
- All players share one arena with the same wave structure as solo
- Enemy HP and count scaled ×1.3 per additional player
- Host-chosen difficulty applies to all

### Economy
- **Shared banana pool** — any player collecting a banana adds to the team total
- Shop phase: shared UI, any player can buy — first click wins, pool updates for all instantly
- Pool displayed in HUD for all players

### Death & Revive
- Downed player's mesh stays in place, greyed out
- Living teammate stands within 1.2 units for 3 continuous seconds to revive at 40% HP
- Circular progress ring renders around downed player while being revived
- Revive prompt shown on screen when near a downed teammate
- All players dead simultaneously → game over

### HUD Additions
- Top-left: small portrait row (class icon + HP bar) for each player
- Shared banana pool counter replaces solo banana count

---

## PvP Mode

### Structure
- First to 3 round wins takes the match
- Each round: fresh start, players spawn at opposite corners
- Round timer: 90 seconds — if time runs out, highest HP wins; equal HP = draw

### Combat
- Players damage each other with all standard attacks at normal damage values
- No enemies
- Banana pickups and health orbs spawn around the arena each round to encourage movement

### Upgrades
- Round winner: goes to upgrade screen — 3 choices, free (0 bananas)
- Round loser: waits on results screen showing current score (e.g. 1–0)
- Upgrades carry into subsequent rounds — momentum matters

### Spectating
- Eliminated players: free-floating top-down camera, mouse pans the view
- Score overlay shown while spectating
- After round ends: all players (alive + spectating) see 3-second round result screen before next round

### Match End
- Full-screen results panel: final score, winner's monkey, **Rematch** / **Back to Lobby** buttons

---

## Networking Protocol

### Client → Server (every frame)
```js
{
  keys: ['KeyW', 'KeyA'],   // held keys
  mouseAngle: 1.57,          // aim direction in radians
  lmb: true,                 // left mouse button
  shift: false,              // special ability
  space: false               // dash
}
```

### Server → Clients (20×/sec)
```js
{
  players: [{ id, x, z, hp, class, comboStep, dashing, rageActive, isDead, isDown }],
  enemies: [{ id, x, z, hp, type }],
  bananas: [{ id, x, z, collected }],
  sharedPool: 12,
  phase: 'fight' | 'shop' | 'vacuum' | 'transition'
}
```

### Event messages (instant)
| Event | Direction | Trigger |
|---|---|---|
| `player-join` | S→C | Player connects to room |
| `player-leave` | S→C | Player disconnects |
| `player-died` | S→C | HP reaches 0 |
| `player-downed` | S→C | Co-op: player needs revive |
| `revive-start` | C→S | Standing near downed player |
| `revive-complete` | S→C | Revive finished |
| `buy-upgrade` | C→S | Player selects upgrade in shop |
| `upgrade-applied` | S→C | Server confirms purchase, updates pool |
| `round-end` | S→C | PvP round resolved |
| `match-end` | S→C | First to 3 round wins achieved |
| `host-change` | S→C | Host disconnected, new host assigned |

---

## Render Deployment

- Socket.io works on Render's free tier (WebSockets supported)
- No changes to `ecosystem.config.cjs` or `Caddyfile` needed
- Server sleeps after 15min inactivity on free tier — first visitor wakes it (~30s delay)

---

## Out of Scope

- Voice/text chat (noted as future `chat` event)
- Persistent accounts or stats
- Ranked matchmaking
- More than 4 players
