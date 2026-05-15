import React from "react";
import Die from "./components/Die";
import Confetti from "react-confetti";

const AVATARS = [
	"/avatars/1.png",
	"/avatars/2.png",
	"/avatars/3.png",
	"/avatars/4.png",
	"/avatars/5.png",
];

const DICE_COLORS = [
	{ id: "red", label: "Red", hex: "#d32f2f" },
	{ id: "orange", label: "Orange", hex: "#f57c00" },
	{ id: "yellow", label: "Yellow", hex: "#f9a825" },
	{ id: "green", label: "Green", hex: "#2e7d32" },
	{ id: "cyan", label: "Cyan", hex: "#00897b" },
	{ id: "blue", label: "Blue", hex: "#1976d2" },
	{ id: "purple", label: "Purple", hex: "#7e57c2" },
	{ id: "pink", label: "Pink", hex: "#c2185b" },
	{ id: "brown", label: "Brown", hex: "#5d4037" },
];

function getDiceColorHex(id) {
	const match = DICE_COLORS.find((color) => color.id === id);
	return match ? match.hex : DICE_COLORS[0].hex;
}

const FACES = [1, 2, 3, 4, 5, 6];

function FaceIcon({ value }) {
	return (
		<div className={`face-icon --${value}`}>
			{value === 1 && <span className="dot"></span>}
			{value === 2 && (
				<>
					<span className="dot"></span>
					<span className="dot"></span>
				</>
			)}
			{value === 3 && (
				<>
					<span className="dot"></span>
					<span className="dot"></span>
					<span className="dot"></span>
				</>
			)}
			{value === 4 && (
				<>
					<div className="column">
						<span className="dot"></span>
						<span className="dot"></span>
					</div>
					<div className="column">
						<span className="dot"></span>
						<span className="dot"></span>
					</div>
				</>
			)}
			{value === 5 && (
				<>
					<div className="column">
						<span className="dot"></span>
						<span className="dot"></span>
					</div>
					<div className="column">
						<span className="dot"></span>
					</div>
					<div className="column">
						<span className="dot"></span>
						<span className="dot"></span>
					</div>
				</>
			)}
			{value === 6 && (
				<>
					<div className="column">
						<span className="dot"></span>
						<span className="dot"></span>
						<span className="dot"></span>
					</div>
					<div className="column">
						<span className="dot"></span>
						<span className="dot"></span>
						<span className="dot"></span>
					</div>
				</>
			)}
		</div>
	);
}

export default function App() {
	const wsRef = React.useRef(null);
	const toastTimerRef = React.useRef(null);
	const [nameInput, setNameInput] = React.useState("");
	const [hasJoined, setHasJoined] = React.useState(false);
	const [playerId, setPlayerId] = React.useState("");
	const [status, setStatus] = React.useState("disconnected");
	const [error, setError] = React.useState("");
	const [playerName, setPlayerName] = React.useState("");
	const [selectedAvatar, setSelectedAvatar] = React.useState(AVATARS[0]);
	const [playerAvatar, setPlayerAvatar] = React.useState(AVATARS[0]);
	const [selectedDiceColor, setSelectedDiceColor] = React.useState(
		DICE_COLORS[0].id
	);
	const [playerDiceColor, setPlayerDiceColor] = React.useState(
		DICE_COLORS[0].id
	);
	const [tenzieToast, setTenzieToast] = React.useState(null);
	const [winEvent, setWinEvent] = React.useState(null);
	const [state, setState] = React.useState({
		players: [],
		bestTime: null,
		bestRolls: null,
		maxPlayers: 4,
	});

	React.useEffect(() => {
		if (!hasJoined) {
			return;
		}

		const sameOriginWsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
		const wsUrl = process.env.REACT_APP_WS_URL || sameOriginWsUrl;
		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;
		setStatus("connecting");

		ws.onopen = () => {
			if (wsRef.current !== ws) {
				return;
			}
			setStatus("connected");
			setError("");
			ws.send(
				JSON.stringify({
					type: "set_name",
					name: playerName.trim(),
					avatar: playerAvatar,
				})
			);
		};

		ws.onmessage = (event) => {
			if (wsRef.current !== ws) {
				return;
			}
			const message = JSON.parse(event.data);
			if (message.type === "welcome") {
				setPlayerId(message.playerId);
				setState(message.state);
				ws.send(
					JSON.stringify({
						type: "set_name",
						name: playerName.trim(),
						avatar: playerAvatar,
						diceColor: playerDiceColor,
					})
				);
				return;
			}
			if (message.type === "state") {
				setState(message.state);
				return;
			}
			if (message.type === "room_full") {
				setError(message.message);
				setStatus("disconnected");
				return;
			}
			if (message.type === "tenzie_event") {
				if (toastTimerRef.current) {
					clearTimeout(toastTimerRef.current);
				}
				setTenzieToast({
					name: message.name,
					avatar: message.avatar,
					key: Date.now(),
				});
				toastTimerRef.current = setTimeout(() => {
					setTenzieToast(null);
					toastTimerRef.current = null;
				}, 1800);
				return;
			}
			if (message.type === "player_won") {
				setWinEvent({
					name: message.name,
					avatar: message.avatar,
				});
				return;
			}
			if (message.type === "error") {
				setError(message.message);
			}
		};

		ws.onclose = () => {
			if (wsRef.current !== ws) {
				return;
			}
			setStatus("disconnected");
		};

		ws.onerror = () => {
			if (wsRef.current !== ws) {
				return;
			}
			setError("WebSocket connection error.");
		};

		return () => {
			ws.close();
		};
	}, [hasJoined, playerName, playerAvatar, playerDiceColor]);

	function sendMessage(payload) {
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(payload));
		}
	}

	const currentPlayer = state.players.find((player) => player.id === playerId);

	function submitName(event) {
		event.preventDefault();
		if (!nameInput.trim()) {
			setError("Please enter a name.");
			return;
		}
		setError("");
		setPlayerName(nameInput.trim());
		setPlayerAvatar(selectedAvatar);
		setPlayerDiceColor(selectedDiceColor);
		setHasJoined(true);
	}

	if (!hasJoined) {
		return (
			<div className="login-screen">
				<form className="login-card" onSubmit={submitName}>
					<h1 className="title">Join Tenzi Multiplayer</h1>
					<label htmlFor="playerName">Player name</label>
					<input
						id="playerName"
						type="text"
						maxLength={24}
						value={nameInput}
						onChange={(event) => setNameInput(event.target.value)}
						placeholder="Your name"
					/>

					<p className="avatar-label">Choose an avatar</p>
					<div className="avatar-grid">
						{AVATARS.map((avatar) => (
							<button
								key={avatar}
								type="button"
								className={`avatar-option ${
									selectedAvatar === avatar ? "avatar-selected" : ""
								}`}
								onClick={() => setSelectedAvatar(avatar)}
							>
								<img src={avatar} alt="Avatar choice" />
							</button>
						))}
					</div>

					<p className="avatar-label">Dice color</p>
					<div className="dice-color-grid">
						{DICE_COLORS.map((color) => (
							<button
								key={color.id}
								type="button"
								className={`dice-color-option ${
									selectedDiceColor === color.id ? "dice-color-selected" : ""
								}`}
								onClick={() => setSelectedDiceColor(color.id)}
								aria-label={color.label}
							>
								<span
									className="dice-color-swatch"
									style={{ backgroundColor: color.hex }}
								/>
							</button>
						))}
					</div>

					<button type="submit" className="join-btn">
						Join game
					</button>
					{error && <p className="error">{error}</p>}
				</form>
			</div>
		);
	}

	const otherPlayers = state.players.filter((player) => player.id !== playerId);

	return (
		<div className="app-shell">
			{winEvent && (
				<div className="win-overlay">
					<div className="win-popup">
						<img
							className="win-avatar"
							src={winEvent.avatar || AVATARS[0]}
							alt=""
						/>
						<h2 className="win-title">{winEvent.name} wins!</h2>
						<button
							className="win-button"
							onClick={() => setHasJoined(false)}
						>
							Play Again
						</button>
					</div>
				</div>
			)}
			{tenzieToast && (
				<div className="tenzie-toast" key={tenzieToast.key}>
					<img
						className="tenzie-toast-avatar"
						src={tenzieToast.avatar || AVATARS[0]}
						alt=""
					/>
					<p className="tenzie-toast-text">Tenzie!</p>
					<p className="tenzie-toast-name">{tenzieToast.name}</p>
				</div>
			)}
			<aside className="side-panel">
				<h1 className="title">Tenzi Multiplayer</h1>
				<p className="gameDescription">
					Collect all six sets (1 – 6). Freeze 10 of a kind, then Bank the set.
					First to bank all six wins.
				</p>
				<div className="panel-stats">
					<p>
						Players: {state.players.length}/{state.maxPlayers}
					</p>
					<p>
						Global best time:{" "}
						{state.bestTime === null ? "--" : `${state.bestTime}s`}
					</p>
					<p>
						Global best rolls:{" "}
						{state.bestRolls === null ? "--" : state.bestRolls}
					</p>
					<p>Connection: {status}</p>
				</div>

				{error && <p className="error">{error}</p>}
			</aside>

			<main className="board-wrap">
				{currentPlayer?.tenzies && (
					<Confetti width={window.innerWidth} height={window.innerHeight} />
				)}
				<div className="boards-grid">
					{state.players.map((player) => {
						const isCurrentPlayer = player.id === playerId;
						const banked = player.bankedValues || [];
						return (
							<section
								key={player.id}
								className={`player-board ${
									isCurrentPlayer ? "active-board" : "other-board"
								}`}
							>
								<div className="board-header">
									<img
										className="player-avatar"
										src={player.avatar || AVATARS[0]}
										alt={`${player.name} avatar`}
									/>
									<h2 className="board-player-name">{player.name}</h2>
								</div>
								<div className="wrapper__stats">
									<h3 className="counter--roll">
										Rolls<p>{player.rollCount}</p>
									</h3>
									<h3 className="timer">
										Time<p>{player.time}s</p>
									</h3>
									<h3 className="bestTimer">
										Sets<p>{banked.length}/6</p>
									</h3>
								</div>
								<div className="wrapper__dice">
									{player.dice.map((die) => (
										<Die
											key={die.id}
											value={die.value}
											isFrozen={die.isFrozen}
											disabled={!isCurrentPlayer}
											diceColor={getDiceColorHex(player.diceColor)}
											holdDice={() =>
												sendMessage({
													type: "toggle_hold",
													dieId: die.id,
												})
											}
										/>
									))}
								</div>

								{isCurrentPlayer ? (
									player.tenzies ? (
										<div className="board-actions">
											<button
												className="button__dice"
												onClick={() => sendMessage({ type: "roll_or_new" })}
											>
												New Game
											</button>
										</div>
									) : (
										<div className="board-actions">
											<button
												className="button__dice"
												onClick={() => sendMessage({ type: "roll_or_new" })}
											>
												Roll Dice
											</button>
											<button
												className={`button__dice button__bank${
													player.setReady ? " button__bank-ready" : ""
												}`}
												onClick={() => sendMessage({ type: "bank_set" })}
												disabled={!player.setReady}
											>
												Tenzie!
											</button>
										</div>
									)
								) : (
									<p className="view-only">View only</p>
								)}
							</section>
						);
					})}
				</div>
			</main>

			<footer className="hud">
				<div className="hud-progress">
					<span className="hud-label">Your sets</span>
					<div className="hud-faces">
						{FACES.map((face) => {
							const done = (currentPlayer?.bankedValues || []).includes(face);
							return (
								<div
									key={face}
									className={`hud-face ${done ? "hud-face-done" : ""}`}
								>
									<FaceIcon value={face} />
									{done && <span className="hud-x" aria-hidden="true">×</span>}
								</div>
							);
						})}
					</div>
				</div>
				{otherPlayers.length > 0 && (
					<div className="hud-players">
						{otherPlayers.map((player) => {
							const pct = Math.round(
								((player.bankedValues || []).length / 6) * 100
							);
							return (
								<div key={player.id} className="hud-player">
									<img
										className="hud-avatar"
										src={player.avatar || AVATARS[0]}
										alt=""
									/>
									<div className="hud-player-meta">
										<span className="hud-player-name">{player.name}</span>
										<div className="hud-bar">
											<div
												className="hud-bar-fill"
												style={{ width: `${pct}%` }}
											/>
										</div>
									</div>
									<span className="hud-pct">{pct}%</span>
								</div>
							);
						})}
					</div>
				)}
			</footer>
		</div>
	);
}
