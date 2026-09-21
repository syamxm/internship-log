const PORT = 4173;

module.exports = {
  apps: [
    {
      name: `chronos-${PORT}`,
      script: "server.js",
      cwd: __dirname,
      env: { PORT },
    },
  ],
};
