const { randomUUID } = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3010);
const HOST = process.env.HOST || (IS_PRODUCTION ? "0.0.0.0" : "127.0.0.1");
const MAX_PLAYERS = 4;
const BUILD_DIR = path.join(__dirname, "build");
const DICE_COLORS = new Set([
	"red",
	"orange",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"pink",
	"brown",
]);

const clients = new Map();
const players = new Map();
let nextPlayerNumber = 1;
let bestTime = null;
let bestRolls = null;
let gameStarted = false;
let gameStartTime = null;

function createDie() {
	return {
		id: randomUUID(),
		value: Math.ceil(Math.random() * 6),
		isFrozen: false,
	};
}

function createDiceSet() {
	return Array.from({ length: 10 }, createDie);
}

function createPlayer() {
	return {
		name: `Player ${nextPlayerNumber}`,
		avatar: "/avatars/1.png",
		diceColor: "green",
		dice: createDiceSet(),
		rollCount: 0,
		startTime: Date.now(),
		tenzies: false,
		finishedTime: 0,
		bankedValues: [],
	};
}

function getPlayerTime(player) {
	if (!gameStarted || !gameStartTime) {
		return 0;
	}
	if (player.tenzies) {
		return player.finishedTime;
	}
	return Math.floor((Date.now() - gameStartTime) / 1000);
}

function isSetReadyToBank(player) {
	const allFrozen = player.dice.every((die) => die.isFrozen);
	if (!allFrozen) {
		return false;
	}
	const targetValue = player.dice[0].value;
	const allSameValue = player.dice.every((die) => die.value === targetValue);
	if (!allSameValue) {
		return false;
	}
	return !player.bankedValues.includes(targetValue);
}

function serializeState() {
	const sortedPlayers = [...players.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([id, player]) => ({
			id,
			name: player.name,
			avatar: player.avatar,
			diceColor: player.diceColor,
			dice: player.dice,
			rollCount: player.rollCount,
			tenzies: player.tenzies,
			time: getPlayerTime(player),
			bankedValues: player.bankedValues,
			setReady: isSetReadyToBank(player),
		}));

	return {
		players: sortedPlayers,
		bestTime,
		bestRolls,
		maxPlayers: MAX_PLAYERS,
		gameStarted,
	};
}

function send(ws, payload) {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(payload));
	}
}

function broadcastState() {
	const message = { type: "state", state: serializeState() };
	for (const ws of clients.keys()) {
		send(ws, message);
	}
}

function bankSet(player, playerId) {
	if (!isSetReadyToBank(player)) {
		return false;
	}
	const value = player.dice[0].value;
	player.bankedValues = [...player.bankedValues, value];
	player.dice = player.dice.map((die) => ({ ...die, isFrozen: false }));

	if (player.bankedValues.length === 6) {
		player.tenzies = true;
		player.finishedTime = getPlayerTime(player);

		if (bestTime === null || player.finishedTime < bestTime) {
			bestTime = player.finishedTime;
		}
		if (bestRolls === null || player.rollCount < bestRolls) {
			bestRolls = player.rollCount;
		}

		broadcastPlayerWon({
			playerId,
			name: player.name,
			avatar: player.avatar,
		});
		return "won";
	}
	return true;
}

function broadcastTenzieEvent(payload) {
	const message = { type: "tenzie_event", ...payload };
	for (const ws of clients.keys()) {
		send(ws, message);
	}
}

function broadcastPlayerWon(payload) {
	const message = { type: "player_won", ...payload };
	for (const ws of clients.keys()) {
		send(ws, message);
	}
}

function getContentType(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	const types = {
		".html": "text/html; charset=utf-8",
		".js": "application/javascript; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".svg": "image/svg+xml",
		".ico": "image/x-icon",
		".txt": "text/plain; charset=utf-8",
		".map": "application/json; charset=utf-8",
	};
	return types[ext] || "application/octet-stream";
}

function sendHttp(res, status, body, contentType) {
	res.writeHead(status, { "Content-Type": contentType });
	res.end(body);
}

function sendFile(res, filePath) {
	fs.readFile(filePath, (error, data) => {
		if (error) {
			sendHttp(res, 404, "Not found", "text/plain; charset=utf-8");
			return;
		}
		sendHttp(res, 200, data, getContentType(filePath));
	});
}

const httpServer = http.createServer((req, res) => {
	const requestPath = (req.url || "/").split("?")[0];

	if (requestPath === "/health") {
		sendHttp(
			res,
			200,
			JSON.stringify({ ok: true }),
			"application/json; charset=utf-8"
		);
		return;
	}

	if (!IS_PRODUCTION) {
		sendHttp(
			res,
			200,
			"WebSocket server is running. Use the React dev server for UI in development.",
			"text/plain; charset=utf-8"
		);
		return;
	}

	const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
	const safePath = path.normalize(path.join(BUILD_DIR, normalizedPath));

	if (!safePath.startsWith(BUILD_DIR)) {
		sendHttp(res, 403, "Forbidden", "text/plain; charset=utf-8");
		return;
	}

	fs.stat(safePath, (error, stats) => {
		if (!error && stats.isFile()) {
			sendFile(res, safePath);
			return;
		}
		sendFile(res, path.join(BUILD_DIR, "index.html"));
	});
});

const wss = new WebSocket.Server({ server: httpServer, path: "/ws" });

wss.on("connection", (ws) => {
	if (players.size >= MAX_PLAYERS) {
		send(ws, {
			type: "room_full",
			message: "This room is full (max 4 players).",
		});
		ws.close();
		return;
	}

	const playerId = `player-${nextPlayerNumber++}`;
	const player = createPlayer();
	players.set(playerId, player);
	clients.set(ws, playerId);

	send(ws, {
		type: "welcome",
		playerId,
		state: serializeState(),
	});
	broadcastState();

	ws.on("message", (rawMessage) => {
		let message;
		try {
			message = JSON.parse(rawMessage.toString());
		} catch (error) {
			send(ws, { type: "error", message: "Invalid message payload." });
			return;
		}

		const currentPlayerId = clients.get(ws);
		const currentPlayer = players.get(currentPlayerId);

		if (!currentPlayer) {
			return;
		}

		if (message.type === "set_name") {
			const nextName = String(message.name || "").trim();
			if (nextName) {
				currentPlayer.name = nextName.slice(0, 24);
			}
			const nextAvatar = String(message.avatar || "").trim();
			if (nextAvatar.startsWith("/avatars/")) {
				currentPlayer.avatar = nextAvatar;
			}
			const nextDiceColor = String(message.diceColor || "").trim();
			if (DICE_COLORS.has(nextDiceColor)) {
				currentPlayer.diceColor = nextDiceColor;
			}
			broadcastState();
			return;
		}

		if (message.type === "start_game") {
			if (!gameStarted) {
				gameStarted = true;
				gameStartTime = Date.now();
				for (const player of players.values()) {
					player.startTime = gameStartTime;
				}
			}
			broadcastState();
			return;
		}

		if (message.type === "toggle_hold") {
			currentPlayer.dice = currentPlayer.dice.map((die) =>
				die.id === message.dieId ? { ...die, isFrozen: !die.isFrozen } : die
			);
			broadcastState();
			return;
		}

		if (message.type === "bank_set") {
			const bankResult = bankSet(currentPlayer, currentPlayerId);
			if (bankResult === "won") {
				// Win event is already broadcast in bankSet, don't broadcast tenzie event
			} else if (bankResult) {
				// Regular set was banked, broadcast tenzie event
				broadcastTenzieEvent({
					playerId: currentPlayerId,
					name: currentPlayer.name,
					avatar: currentPlayer.avatar,
				});
			}
			broadcastState();
			return;
		}

		if (message.type === "roll_or_new") {
			if (currentPlayer.tenzies) {
				currentPlayer.dice = createDiceSet();
				currentPlayer.rollCount = 0;
				currentPlayer.tenzies = false;
				currentPlayer.finishedTime = 0;
				currentPlayer.bankedValues = [];
				gameStarted = false;
				gameStartTime = null;
				for (const player of players.values()) {
					player.dice = createDiceSet();
					player.rollCount = 0;
					player.tenzies = false;
					player.finishedTime = 0;
					player.bankedValues = [];
				}
			} else {
				currentPlayer.dice = currentPlayer.dice.map((die) =>
					die.isFrozen ? die : createDie()
				);
				currentPlayer.rollCount += 1;
			}
			broadcastState();
		}
	});

	ws.on("close", () => {
		const currentPlayerId = clients.get(ws);
		clients.delete(ws);

		if (currentPlayerId) {
			players.delete(currentPlayerId);
		}
		broadcastState();
	});
});

setInterval(() => {
	if (players.size > 0) {
		broadcastState();
	}
}, 1000);

httpServer.listen(PORT, HOST, () => {
	console.log(`Tenzie server running on http://${HOST}:${PORT}`);
	console.log(`WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
});
