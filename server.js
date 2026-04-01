import express        from 'express';
import session        from 'express-session';
import path           from 'path';
import { fileURLToPath } from 'url';
import { createHash }    from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────
// Set GAME_PASSWORD env var before starting, e.g.:
//   GAME_PASSWORD=mysecret pm2 start ecosystem.config.cjs
const GAME_PASSWORD  = process.env.GAME_PASSWORD  || 'monkeymash';
const SESSION_SECRET = process.env.SESSION_SECRET || 'monkey-session-secret-change-me';
const PORT           = process.env.PORT           || 3000;

const passwordHash = createHash('sha256').update(GAME_PASSWORD).digest('hex');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
  },
}));

// ── Auth middleware ───────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session?.authed) return next();
  res.redirect('/login');
}

// ── Login page ───────────────────────────────────────────────────
const loginPage = (error = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monkey Mash — Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b1608;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
      font-family: 'Press Start 2P', monospace;
    }
    .card {
      background: rgba(0,0,0,0.7);
      border: 2px solid #44aa22;
      border-radius: 12px;
      padding: 40px 48px;
      display: flex; flex-direction: column; align-items: center; gap: 24px;
      box-shadow: 0 0 40px rgba(0,180,0,0.2);
      min-width: 320px;
    }
    .title { font-size: 20px; color: #88ff44; text-align: center; line-height: 1.6; }
    .subtitle { font-size: 9px; color: #557744; }
    .error { font-size: 8px; color: #ff4444; }
    input[type="password"] {
      background: #111a0e;
      border: 1px solid #335522;
      border-radius: 6px;
      color: #ccffaa;
      font-family: 'Press Start 2P', monospace;
      font-size: 10px;
      padding: 12px 16px;
      width: 100%;
      outline: none;
    }
    input[type="password"]:focus { border-color: #44ff44; }
    button {
      background: #226611;
      border: none; border-radius: 6px;
      color: #ccffaa;
      cursor: pointer;
      font-family: 'Press Start 2P', monospace;
      font-size: 10px;
      padding: 12px 32px;
      width: 100%;
      transition: background 0.15s;
    }
    button:hover { background: #338822; }
    .monkey { font-size: 40px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="monkey">🐒</div>
    <div class="title">MONKEY<br>MASH</div>
    <div class="subtitle">Enter the password to play</div>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="POST" action="/login" style="width:100%;display:flex;flex-direction:column;gap:16px;">
      <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
      <button type="submit">Enter the Jungle</button>
    </form>
  </div>
</body>
</html>`;

app.get('/login', (req, res) => {
  if (req.session?.authed) return res.redirect('/');
  res.send(loginPage());
});

app.post('/login', (req, res) => {
  const attempt = createHash('sha256').update(req.body.password || '').digest('hex');
  if (attempt === passwordHash) {
    req.session.authed = true;
    return res.redirect('/');
  }
  res.status(401).send(loginPage('Wrong password. Try again!'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Serve game (auth-gated) ───────────────────────────────────────
app.use(requireAuth, express.static(path.join(__dirname, 'dist')));

// Fallback — SPA catch-all (Express 5 syntax)
app.get('/{*splat}', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🐒 Monkey Mash running at http://localhost:${PORT}`);
  console.log(`   Password: ${GAME_PASSWORD}`);
  console.log(`   To change: set GAME_PASSWORD env var before starting`);
});
