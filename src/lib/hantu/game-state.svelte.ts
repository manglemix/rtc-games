import { sfc32StrSeeded, Vector2 } from '$lib/index.svelte';
import type { DataChannelInit, NetworkClient } from '$lib/rtc-client';
import { Image as ImageObj } from "image-js";
import { SvelteMap } from 'svelte/reactivity';

export const DATA_CHANNELS: DataChannelInit[] = [
	{
		label: 'game-state',
		hostOnly: true
	},
	{
		label: 'key-action'
	},
	{
		label: 'player-kinematics',
		ordered: false,
		maxRetransmits: 0
	}
];

type GameStateMessage = {
	elapsedMsecs: number,
	setState?: { state: State }
};
type KeyActionMessage = {
	propose?: { names: string[], final?: boolean },
	vote?: { value: boolean }
};

const POSSESSED_RATIO = 0.3333333;
const PROPOSAL_RATIO = 0.4;

export enum State {
	FirstInfo,
	KeyProposition,
	KeyVote,
	KeyVoteResults,
	Day,
	Night,
	FinalVote
}

export class GameState {
	public readonly netClient: NetworkClient;
	public readonly startTimeMsecs: number;
	public readonly proposalCount: number;

	private _elapsedMsecs: number = $state(0);
	private _state: State = $state(State.FirstInfo);
	private timeoutId?: number;
	private timeoutCallback?: () => void;
	private _players: SvelteMap<string, Player> = $state(new SvelteMap());
	private rng: () => number;
	private possessedPlayers: Set<string> = new Set();
	private updatePlayerKinematicsInterval = 0;
	private readonly _votes = $state(new SvelteMap<string, boolean>());
	private _proposals: string[] = $state([]);

	get state() {
		return this._state;
	}

	get elapsedMsecs() {
		return this._elapsedMsecs;
	}

	get players() {
		return this._players;
	}

	get votes() {
		return this._votes;
	}

	get proposals() {
		return this._proposals;
	}

	public constructor(netClient: NetworkClient, roomCode: string, startTimeMsecs: number) {
		this.netClient = netClient;

		for (const peerName of netClient.getPeerNames()) {
			this._players.set(peerName, new Player());
		}
		this._players.set(netClient.name, new Player());

		this.rng = sfc32StrSeeded(roomCode);
		this.startTimeMsecs = startTimeMsecs;
		netClient.setOnMessage('game-state', (from, msg) => {
			const obj: GameStateMessage = JSON.parse(msg.data);
			if (obj.elapsedMsecs) {
				this._elapsedMsecs = obj.elapsedMsecs;
			}
			if (obj.setState) {
				// if (this.timeoutId) {
				// 	clearTimeout(this.timeoutId);
				// 	this.timeoutId = undefined;
				// }
				this._state = obj.setState.state;
			}
		});

		this.proposalCount = Math.round(PROPOSAL_RATIO * (this.netClient.getPeerNames().length + 1));
		let possessedCount = POSSESSED_RATIO * (this.netClient.getPeerNames().length + 1);
		possessedCount = Math.round(possessedCount);
		if (possessedCount === 0) {
			possessedCount = 1;
		}
		const names = this.netClient.getPeerNames();
		names.push(this.netClient.name);

		while (this.possessedPlayers.size < possessedCount) {
			this.possessedPlayers.add(names[this.randInt(0, names.length - 1)]);
		}

		// Propagate player kinematics at 20fps
		this.updatePlayerKinematicsInterval = setInterval(() => {
			if (this.state === State.Day || this.state === State.Night) {
				const thisPlayer = this.getThisPlayer();
				this.netClient.send('player-kinematics', JSON.stringify({ origin: thisPlayer.origin.toJSON(), velocity: thisPlayer.velocity.toJSON() }));
			}
		}, 50);
		this.netClient.setOnMessage('player-kinematics', (from, msg) => {
			const obj = JSON.parse(msg.data);
			const player = this.players.get(from);
			if (player) {
				if (obj.origin) {
					player.origin = Vector2.fromJSON(obj.origin);
				}
				if (obj.velocity) {
					player.velocity = Vector2.fromJSON(obj.velocity);
				}
			} else {
				console.error('Received player kinematics from unknown player: ' + from);
			}
		});

		this.netClient.setOnMessage('key-action', (from, msg) => {
			const action: KeyActionMessage = JSON.parse(msg.data);

			if (this.state === State.KeyProposition) {
				if (action.propose) {
					this.setProposalsPrivate(action.propose.names, action.propose.final);
				} else {
					console.error('Received invalid key proposal message: ' + action + ' from ' + from);
				}
			} else if (this.state === State.KeyVote) {
				if (action.vote) {
					this.setVotePrivate(from, action.vote.value);
				} else {
					console.error('Received invalid key vote message: ' + action + ' from ' + from);
				}
			} else {
				console.error('Received key action message in invalid state: ' + this.state + ' from ' + from);
			}
		});
		if (this.netClient.isHost) {
			this.elapseTime(5, () => this.setStateAsHost(State.KeyProposition));
		}
	}

	public voteFor(name: string, voteYes: boolean) {
		this.setVotePrivate(name, voteYes);
		this.sendKeyAction({ vote: { value: voteYes } });
	}

	private setVotePrivate(of: string, voteYes: boolean) {
		this.votes.set(of, voteYes);
		if (this.netClient.isHost) {
			if (this.votes.size === this.netClient.getPeerNames().length + 1) {
				clearTimeout(this.timeoutId);
				this.setStateAsHost(State.KeyVoteResults);
			}
		}
	}

	public setProposals(names: string[], final?: boolean) {
		this.setProposalsPrivate(names, final);
		this.sendKeyAction({ propose: { names, final } });
	}

	private setProposalsPrivate(names: string[], final?: boolean) {
		this._proposals = names;
		if (this.netClient.isHost && final) {
			clearTimeout(this.timeoutId);
			this.setStateAsHost(State.KeyVote);
		}
	}

	public getThisPlayer(): Player {
		return this._players.get(this.netClient.name)!;
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

	public close() {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}
		clearInterval(this.updatePlayerKinematicsInterval);
		this.netClient.close();
	}

	private setStateAsHost(newState: State) {
		if (!this.netClient.isHost) {
			console.error('Only the host can set the game state');
			return;
		}
		this._state = newState;
		this._elapsedMsecs = Date.now() - this.startTimeMsecs;
		this.sendGameState({ setState: { state: newState }, elapsedMsecs: this.elapsedMsecs });
		switch (newState) {
			case State.KeyProposition:
				this.elapseTime(30, () => this.setStateAsHost(State.KeyVote));
				break;
			case State.KeyVote:
				this.elapseTime(30, () => this.setStateAsHost(State.KeyVoteResults));
				break;
			case State.KeyVoteResults:
				this.elapseTime(3, () => this.setStateAsHost(State.Day));
				break;
			case State.Day:
				this.elapseTime(120, () => this.setStateAsHost(State.Night));
				break;
			case State.Night:
				this.elapseTime(100, () => this.setStateAsHost(State.KeyVote));
				break;
			default:
				console.error('Unknown state: ' + newState);
		}
	}

	private elapseTime(durationSecs: number, callback: () => void) {
		this.timeoutCallback = callback;
		this.timeoutId = setTimeout(
			() => {
				this.timeoutId = undefined;
				this._elapsedMsecs += durationSecs * 1000;
				if (this.timeoutCallback) {
					callback = this.timeoutCallback;
					this.timeoutCallback = undefined;
					callback();
				}
			},
			durationSecs * 1000 + this._elapsedMsecs + this.startTimeMsecs - Date.now()
		);
	}

	private sendGameState(msg: GameStateMessage) {
		if (!this.netClient.isHost) {
			console.error('Only the host can send game state messages');
			return;
		}
		this.netClient.send('game-state', JSON.stringify(msg));
	}

	private sendKeyAction(msg: KeyActionMessage) {
		this.netClient.send('key-action', JSON.stringify(msg));
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
	private _origin: Vector2 = $state(new Vector2(200, 260));
	public collisionMask?: ImageObj;

	get origin() {
		return this._origin;
	}

	get velocity() {
		return this._velocity;
	}

	set origin(newOrigin: Vector2) {
		this._origin = newOrigin;
	}

	set velocity(newVelocity: Vector2) {
		this._velocity = newVelocity;
	}

	public process(delta: number) {
		const step = this.velocity.mul(delta);
		if (this.collisionMask) {
			let stepAbs = step.abs();
			const sign = step.sign();
			const toCheck = this.origin;
			while (stepAbs.x > 0) {
				const oldToCheckX = toCheck.x;
				if (stepAbs.x >= 1) {
					stepAbs.x -= 1;
					toCheck.x += sign.x;
				} else {
					toCheck.x += stepAbs.x * sign.x;
					stepAbs.x = 0;
				}
				if (this.collisionMask.getPixelXY(Math.round(toCheck.x), Math.round(toCheck.y))[0] !== 0) {
					this.velocity.x = 0;
					toCheck.x = oldToCheckX;
					break;
				}
			}
			while (stepAbs.y > 0) {
				const oldToCheckY = toCheck.y;
				if (stepAbs.y >= 1) {
					stepAbs.y -= 1;
					toCheck.y += sign.y;
				} else {
					toCheck.y += stepAbs.y * sign.y;
					stepAbs.y = 0;
				}
				if (this.collisionMask.getPixelXY(Math.round(toCheck.x), Math.round(toCheck.y))[0] !== 0) {
					this.velocity.y = 0;
					toCheck.y = oldToCheckY;
					break;
				}
			}
			this.origin = toCheck;
		} else {
			this.origin = this.origin.add(step);
		}
	}
}
