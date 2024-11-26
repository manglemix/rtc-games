import { sfc32StrSeeded, Vector2 } from '$lib';
import type { DataChannelInit, NetworkClient } from '$lib/rtc-client';

export const DATA_CHANNELS: DataChannelInit[] = [
	{
		label: 'game-state',
		hostOnly: true
	},
	{
		label: 'player-state'
	},
	{
		label: 'player-kinematics',
		ordered: false,
		maxRetransmits: 0
	}
];

const POSSESSED_RATIO = 0.15;

export enum State {
	FirstInfo,
	KeyProposition,
	KeyVote,
	Day,
	Night,
	FinalVote
}

export class GameState {
	public readonly netClient: NetworkClient;
	public readonly startTimeMsecs: number;
	private _elapsedMsecs: number = 0;
	private _state: State = $state(State.FirstInfo);
	private timeoutId?: number;
	private timeoutCallback?: () => void;
	private timerStartTimeMsecs: number = 0;
	private _player: Player = new Player(this);

	get state() {
		return this._state;
	}

	get elapsedMsecs() {
		return this._elapsedMsecs;
	}

	get player() {
		return this._player;
	}

	private rng: () => number;
	private possessedPlayers: Set<string> = new Set();

	public constructor(netClient: NetworkClient, roomCode: string, startTimeMsecs: number) {
		this.netClient = netClient;
		this.rng = sfc32StrSeeded(roomCode);
		this.startTimeMsecs = startTimeMsecs;
		netClient.setOnMessage('game-state', (from, msg) => {
			const obj = JSON.parse(msg.data);
			if (obj.elapsedMsecs) {
				this._elapsedMsecs = obj.elapsedMsecs;
			}
			if (obj.action) {
				switch (obj.action) {
					case 'skip':
						if (obj.state === this._state) {
							this.skipTimer();
						}
						break;
					default:
						console.error('Unknown action: ' + obj.action);
				}
			}
		});

		let possessedCount = POSSESSED_RATIO * (this.netClient.getPeerNames().length + 1);
		possessedCount = Math.round(possessedCount);
		if (possessedCount == 0) {
			possessedCount = 1;
		}
		const names = this.netClient.getPeerNames();
		names.push(this.netClient.name);

		while (this.possessedPlayers.size < possessedCount) {
			this.possessedPlayers.add(names[this.randInt(0, names.length - 1)]);
		}
		this.elapseTime(5, this.enterKeyProposition);
	}

	public getPossessed(): Set<string> {
		return this.possessedPlayers;
	}

	public getOtherPossessed(): Set<string> {
		const otherPossessed = new Set(this.possessedPlayers);
		otherPossessed.delete(this.netClient.name);
		return otherPossessed;
	}

	public areWePossessed(): boolean {
		return this.possessedPlayers.has(this.netClient.name);
	}

	public skipTimer() {
		if (this.timeoutId) {
			this._elapsedMsecs += Date.now() - this.timerStartTimeMsecs;
			clearTimeout(this.timeoutId);
			this.timeoutId = undefined;
			this.netClient.send(
				'game-state',
				JSON.stringify({ elapsedMsecs: this._elapsedMsecs, action: 'skip', state: this._state })
			);
			if (this.timeoutCallback) {
				this.timeoutCallback();
				this.timeoutCallback = undefined;
			} else {
				console.error('No callback to call');
			}
		}
	}

	private elapseTime(durationSecs: number, callback: () => void) {
		this.timerStartTimeMsecs = Date.now();
		this.timeoutCallback = callback;
		this.timeoutId = setTimeout(
			() => {
				this.timeoutId = undefined;
				this._elapsedMsecs += durationSecs * 1000;
				if (this.timeoutCallback) {
					this.timeoutCallback();
					this.timeoutCallback = undefined;
				}
			},
			durationSecs * 1000 + this._elapsedMsecs + this.startTimeMsecs - Date.now()
		);
	}

	private enterKeyProposition() {
		this._state = State.KeyProposition;
		this.elapseTime(30, () => {
			this._state = State.KeyVote;
		});
	}

	/**
	 * Generate a random integer between min and max (inclusive)
	 * @param min
	 * @param max
	 * @returns
	 */
	private randInt(min: number, max: number): number {
		return Math.floor(this.rng() * (max - min + 1) + min);
	}

	private randFloat(min: number, max: number): number {
		return this.rng() * (max - min) + min;
	}
}

export class Player {
	private _velocity: Vector2 = $state(new Vector2(0, 0));
	private _origin: Vector2 = $state(new Vector2(0, 0));

	constructor(private readonly gameState: GameState) {}

	get origin() {
		return this._origin;
	}

	get velocity() {
		return this._velocity;
	}

	public setOrigin(origin: Vector2) {
		this._origin = origin;
		this.gameState.netClient.send('player-kinematics', JSON.stringify({ origin: this._origin }));
	}

	public setVelocity(velocity: Vector2) {
		this._velocity = velocity;
		this.gameState.netClient.send('player-kinematics', JSON.stringify({ velocity: this.velocity }));
	}

	public process(delta: number) {
		this._origin = this._origin.add(this._velocity.mul(delta));
	}
}
