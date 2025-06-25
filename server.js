const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const WIDTH = 3200, HEIGHT = 1600;
const MIN_PLAYERS = 6, ROUND_TIME = 180;
const OBSTACLES = [...Array(20)].map(() => ({
  x: Math.random() * WIDTH,
  y: Math.random() * HEIGHT,
  w: 100, h: 100
}));

let players = {}, roundTimer = null, roundStart = 0;

// send state to all
function broadcast(msg) {
  const str = JSON.stringify(msg);
  wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(str));
}

// start when enough players
function tryStartRound() {
  if (!roundTimer && Object.keys(players).length >= MIN_PLAYERS) {
    roundStart = Date.now();
    broadcast({ type: 'startRound', obstacles: OBSTACLES, startTime: roundStart });
    roundTimer = setInterval(update, 1000 / 30);
  }
}

// handle movement/state
function update() {
  const now = Date.now();
  const t = (now - roundStart) / 1000;
  if (t >= ROUND_TIME) return endRound();

  // collision + scoring
  let it = Object.values(players).find(p => p.isIt);
  if (!it) {
    const list = Object.values(players);
    const rand = list[Math.floor(Math.random() * list.length)];
    rand.isIt = true;
    it = rand;
  }
  // collision checking
  Object.values(players).forEach(p => {
    if (!p.isIt) {
      if (t % 1 < 0.033) p.score += 5;
      if (Math.hypot(it.x - p.x, it.y - p.y) < p.radius + it.radius) {
        it.isIt = false; p.isIt = true;
        broadcast({ type: 'swapIt', newIt: p.id });
      }
    }
  });
  broadcast({ type: 'state', players, timeLeft: ROUND_TIME - t });
}

function endRound() {
  clearInterval(roundTimer);
  roundTimer = null;
  broadcast({ type: 'endRound', players });
  players = {};
}

wss.on('connection', ws => {
  ws.on('message', msg => {
    const d = JSON.parse(msg);
    if (d.type === 'join') {
      players[d.id] = {
        id: d.id, name: d.name, x: Math.random() * WIDTH, y: Math.random() * HEIGHT,
        vx: 0, vy: 0, radius: 20, score: 0, isIt: false
      };
      tryStartRound();
    }
    if (d.type === 'move' && players[d.id]) {
      const p = players[d.id];
      p.vx = d.vx; p.vy = d.vy;
      p.x = Math.max(0, Math.min(WIDTH, p.x + p.vx * 2));
      p.y = Math.max(0, Math.min(HEIGHT, p.y + p.vy * 2));
    }
  });
});

console.log('WebSocket server running');
