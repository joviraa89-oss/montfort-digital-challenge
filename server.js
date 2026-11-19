const express = require("express");
const http = require("http");
const os = require("os");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/host", (req, res) => res.sendFile(path.join(__dirname, "public", "host.html")));

const players = new Map();

io.on("connection", (socket) => {
  socket.emit("leaderboard", [...players.values()].sort((a,b) => b.score-a.score));

  socket.on("join-game", ({ name, mode }) => {
    const cleanName = String(name || "Player").trim().slice(0, 24) || "Player";
    const player = {
      id: socket.id,
      name: cleanName,
      mode: mode === "student" ? "Student" : "Visitor",
      round: 1,
      score: 0,
      completed: false,
      status: "Playing"
    };
    players.set(socket.id, player);
    socket.emit("joined", player);
    io.emit("leaderboard", [...players.values()].sort((a,b) => b.score-a.score));
  });

  socket.on("update-score", ({ score, round, completed }) => {
    const p = players.get(socket.id);
    if (!p) return;
    p.score = Math.max(p.score, Number(score) || 0);
    p.round = Number(round) || p.round;
    p.completed = Boolean(completed);
    p.status = p.completed ? "Completed" : "Playing";
    io.emit("leaderboard", [...players.values()].sort((a,b) => b.score-a.score));
  });

  socket.on("disconnect", () => {
    // Keep completed and in-progress scores visible if a player closes the tab.
    const p = players.get(socket.id);
    if (p) {
      p.status = p.completed ? "Completed" : "Disconnected";
      io.emit("leaderboard", [...players.values()].sort((a,b) => b.score-a.score));
    }
  });

  socket.on("clear-leaderboard", () => {
    players.clear();
    io.emit("leaderboard", []);
  });
});

function getLocalIPv4() {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const net of (list || [])) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

app.get("/api/info", (req, res) => {
  const host = req.headers.host || `${getLocalIPv4()}:${PORT}`;
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  res.json({ joinUrl: `${protocol}://${host}/`, hostUrl: `${protocol}://${host}/host` });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("\nMontfort Digital Challenge is running!");
  console.log(`Host screen: http://localhost:${PORT}/host`);
  console.log(`Phone join link (same Wi-Fi): http://${getLocalIPv4()}:${PORT}/`);
  console.log("For visitors outside the school Wi-Fi, deploy this app to a public HTTPS host.\n");
});
