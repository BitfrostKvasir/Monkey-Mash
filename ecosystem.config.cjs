module.exports = {
  apps: [
    {
      name: 'monkey-mash',
      script: 'server.js',
      // Set your password and a long random session secret here
      env: {
        NODE_ENV:        'production',
        PORT:            '3000',
        GAME_PASSWORD:   'monkeymash',
        SESSION_SECRET:  'change-this-to-a-long-random-string',
      },
      // Restart automatically on crash
      autorestart: true,
      watch:       false,
      max_restarts: 10,
      // Restart if memory exceeds 300 MB
      max_memory_restart: '300M',
    },
  ],
};
