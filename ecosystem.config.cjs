module.exports = {
  apps : [{
    name: "Airplus-server",
    script: "./dist/server.cjs",
    env: {
      PORT: 3001
    }
  }]
}