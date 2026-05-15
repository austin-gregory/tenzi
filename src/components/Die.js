import React from "react";

export default function Die({ value, isFrozen, holdDice, disabled, diceColor }) {
	const baseClass = isFrozen ? "isFrozen" : "dice";
	const colorClass = diceColor && !isFrozen ? " colored-die" : "";
	const style = !isFrozen && diceColor ? { backgroundColor: diceColor } : undefined;

	return (
		<button
			type="button"
			className={`${baseClass}${colorClass}`}
			style={style}
			onClick={holdDice}
			disabled={disabled}
		>
			{value === 1 && (
				<div className={`--${value}`}>
					<span className="dot"></span>
				</div>
			)}
			{value === 2 && (
				<div className={`--${value}`}>
					<span className="dot"></span>
					<span className="dot"></span>
				</div>
			)}
			{value === 3 && (
				<div className={`--${value}`}>
					<span className="dot"></span>
					<span className="dot"></span>
					<span className="dot"></span>
				</div>
			)}
			{value === 4 && (
				<div className={`--${value}`}>
					<div className="column">
						<span className="dot"></span>
						<span className="dot"></span>
					</div>
					<div className="column">
						<span className="dot"></span>
						<span className="dot"></span>
					</div>
				</div>
			)}
			{value === 5 && (
				<div className={`--${value}`}>
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
				</div>
			)}
			{value === 6 && (
				<div className={`--${value}`}>
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
				</div>
			)}
		</button>
	);
}
