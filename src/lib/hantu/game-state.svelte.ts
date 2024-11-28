import { sfc32StrSeeded, Vector2 } from '$lib/index.svelte';
import type { DataChannelInit, NetworkClient } from '$lib/rtc-client';
import { Image as ImageObj } from "image-js";
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Level } from './levels/level.svelte';

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
	setState?: { state: State, endTimeMsecs: number }
};
type KeyActionMessage = {
	propose?: { names: string[], final?: boolean },
	vote?: { value: boolean }
};
type KinematicsMessage = {
	origin?: { x: number, y: number },
	velocity?: { x: number, y: number }
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

// export class GameState {
// 	public readonly netClient: NetworkClient;
// 	public readonly startTimeMsecs: number;
// 	public readonly proposalCount: number;

// 	private _elapsedMsecs: number = $state(0);
// 	private _state: State = $state(State.FirstInfo);
// 	private timeoutId?: number;
// 	private timeoutCallback?: () => void;
// 	private _players: SvelteMap<string, Player> = $state(new SvelteMap());
// 	private possessedPlayers: Set<string> = new Set();
// 	private updatePlayerKinematicsInterval = 0;
// 	private readonly _votes = $state(new SvelteMap<string, boolean>());
// 	private _proposals: SvelteSet<string> = $state(new SvelteSet());

// 	get state() {
// 		return this._state;
// 	}

// 	get elapsedMsecs() {
// 		return this._elapsedMsecs;
// 	}

// 	get players() {
// 		return this._players;
// 	}

// 	get votes() {
// 		return this._votes;
// 	}

// 	get proposals() {
// 		return this._proposals;
// 	}

// 	private set state(newState: State) {
// 		this._state = newState;
// 		switch (newState) {
// 			case State.KeyProposition:
// 				this.proposals.clear();
// 				break;
// 		}
// 	}

// 	public constructor(netClient: NetworkClient, roomCode: string, startTimeMsecs: number) {
// 		this.netClient = netClient;

// 		for (const peerName of netClient.getPeerNames()) {
// 			this._players.set(peerName, new Player(peerName));
// 		}
// 		this._players.set(netClient.name, new Player(netClient.name));

// 		this.rng = sfc32StrSeeded(roomCode);
// 		this.startTimeMsecs = startTimeMsecs;
// 		netClient.setOnMessage('game-state', (from, msg) => {
// 			const obj: GameStateMessage = JSON.parse(msg.data);
// 			if (obj.elapsedMsecs) {
// 				this._elapsedMsecs = obj.elapsedMsecs;
// 			}
// 			if (obj.setState) {
// 				// if (this.timeoutId) {
// 				// 	clearTimeout(this.timeoutId);
// 				// 	this.timeoutId = undefined;
// 				// }
// 				this._state = obj.setState.state;
// 			}
// 		});

// 		this.proposalCount = Math.max(Math.round(PROPOSAL_RATIO * (this.players.size)), 1);
// 		const possessedCount = Math.max(Math.round(POSSESSED_RATIO * (this.players.size)), 1);
// 		const names = this.netClient.getPeerNames();
// 		names.push(this.netClient.name);
// 		names.sort();

// 		while (this.possessedPlayers.size < possessedCount) {
// 			this.possessedPlayers.add(names[this.randInt(0, names.length - 1)]);
// 		}

// 		// Propagate player kinematics at 20fps
// 		this.updatePlayerKinematicsInterval = setInterval(() => {
// 			if (this.state === State.Day || this.state === State.Night) {
// 				const thisPlayer = this.getThisPlayer();
// 				this.netClient.send('player-kinematics', JSON.stringify({ origin: thisPlayer.origin.toJSON(), velocity: thisPlayer.velocity.toJSON() }));
// 			}
// 		}, 50);
// 		this.netClient.setOnMessage('player-kinematics', (from, msg) => {
// 			const obj = JSON.parse(msg.data);
// 			const player = this.players.get(from);
// 			if (player) {
// 				if (obj.origin) {
// 					player.origin = Vector2.fromJSON(obj.origin);
// 				}
// 				if (obj.velocity) {
// 					player.velocity = Vector2.fromJSON(obj.velocity);
// 				}
// 			} else {
// 				console.error('Received player kinematics from unknown player: ' + from);
// 			}
// 		});

// 		this.netClient.setOnMessage('key-action', (from, msg) => {
// 			const action: KeyActionMessage = JSON.parse(msg.data);

// 			if (this.state === State.KeyProposition) {
// 				if (action.propose) {
// 					this.setProposalsPrivate(new SvelteSet(action.propose.names), action.propose.final);
// 				} else {
// 					console.error('Received invalid key proposal message: ' + action + ' from ' + from);
// 				}
// 			} else if (this.state === State.KeyVote) {
// 				if (action.vote) {
// 					this.setVotePrivate(from, action.vote.value);
// 				} else {
// 					console.error('Received invalid key vote message: ' + action + ' from ' + from);
// 				}
// 			} else {
// 				console.error('Received key action message in invalid state: ' + this.state + ' from ' + from);
// 			}
// 		});
// 		if (this.netClient.isHost) {
// 			this.elapseTime(5, () => this.setStateAsHost(State.KeyProposition));
// 		}
// 	}

// 	public voteFor(name: string, voteYes: boolean) {
// 		this.setVotePrivate(name, voteYes);
// 		this.sendKeyAction({ vote: { value: voteYes } });
// 	}

// 	private setVotePrivate(of: string, voteYes: boolean) {
// 		this.votes.set(of, voteYes);
// 		if (this.netClient.isHost) {
// 			if (this.votes.size === this.players.size) {
// 				clearTimeout(this.timeoutId);
// 				this.setStateAsHost(State.KeyVoteResults);
// 			}
// 		}
// 	}

// 	public finalizeProposals(names: SvelteSet<string>, final?: boolean) {
// 		this.setProposalsPrivate(names, final);
// 		this.sendKeyAction({ propose: { names: Array.from(names), final } });
// 	}

// 	private setProposalsPrivate(names: SvelteSet<string>, final?: boolean) {
// 		this._proposals = names;
// 		if (this.netClient.isHost && final) {
// 			clearTimeout(this.timeoutId);
// 			this.setStateAsHost(State.KeyVote);
// 		}
// 	}

// 	public getThisPlayer(): Player {
// 		return this._players.get(this.netClient.name)!;
// 	}

// 	public getPossessed(): Set<string> {
// 		return this.possessedPlayers;
// 	}

// 	public getOtherPossessed(): Set<string> {
// 		const otherPossessed = new Set(this.possessedPlayers);
// 		otherPossessed.delete(this.netClient.name);
// 		return otherPossessed;
// 	}

// 	public areWePossessed(): boolean {
// 		return this.possessedPlayers.has(this.netClient.name);
// 	}

// 	public getRequiredProposals(): number {
// 		return Math.min(this.proposalCount, this.players.size);
// 	}

// 	public close() {
// 		if (this.timeoutId) {
// 			clearTimeout(this.timeoutId);
// 		}
// 		clearInterval(this.updatePlayerKinematicsInterval);
// 		this.netClient.close();
// 	}

// 	private setStateAsHost(newState: State) {
// 		if (!this.netClient.isHost) {
// 			console.error('Only the host can set the game state');
// 			return;
// 		}
// 		this._state = newState;
// 		this._elapsedMsecs = Date.now() - this.startTimeMsecs;
// 		this.sendGameState({ setState: { state: newState }, elapsedMsecs: this.elapsedMsecs });
// 		switch (newState) {
// 			case State.KeyProposition:
// 				this.elapseTime(30, () => this.setStateAsHost(State.KeyVote));
// 				break;
// 			case State.KeyVote:
// 				this.elapseTime(30, () => this.setStateAsHost(State.KeyVoteResults));
// 				break;
// 			case State.KeyVoteResults:
// 				this.elapseTime(3, () => this.setStateAsHost(State.Day));
// 				break;
// 			case State.Day:
// 				this.elapseTime(120, () => this.setStateAsHost(State.Night));
// 				break;
// 			case State.Night:
// 				this.elapseTime(100, () => this.setStateAsHost(State.KeyVote));
// 				break;
// 			default:
// 				console.error('Unknown state: ' + newState);
// 		}
// 	}

// 	private elapseTime(durationSecs: number, callback: () => void) {
// 		this.timeoutCallback = callback;
// 		this.timeoutId = setTimeout(
// 			() => {
// 				this.timeoutId = undefined;
// 				this._elapsedMsecs += durationSecs * 1000;
// 				if (this.timeoutCallback) {
// 					callback = this.timeoutCallback;
// 					this.timeoutCallback = undefined;
// 					callback();
// 				}
// 			},
// 			durationSecs * 1000 + this._elapsedMsecs + this.startTimeMsecs - Date.now()
// 		);
// 	}

// }

export abstract class GameState {
	public get requiredProposals(): number {
		return $derived.by(() => {
			let aliveCount = 0;
			for (const player of this.players.values()) {
				if (player.alive) {
					aliveCount++;
				}
			}
			return Math.min(
				Math.max(Math.round(PROPOSAL_RATIO * aliveCount), 1),
				this.players.size
			);
		});
	}

	public get state(): State {
		return this._state;
	}

	public get stateEndTimeMsecs(): State {
		return this._stateEndTimeMsecs;
	}

	public get proposerIndex(): number {
		return this._proposerIndex;
	}

	public proposals: SvelteSet<string> = $state(new SvelteSet());
	public readonly thisPlayer: ThisPlayer;
	public readonly players: Map<string, Player> = new Map<string, Player>();

	protected netClient: NetworkClient;
	protected rng: () => number;
	protected _stateEndTimeMsecs: number = $state(Date.now());

	private _state: State = $state(State.FirstInfo);
	private _proposerIndex = $state(0);
	private propagatePlayerKinematicsInterval = 0;
	private processPlayerKinematicsInterval = 0;

	constructor(netClient: NetworkClient, roomCode: string, level: Level) {
		this.rng = sfc32StrSeeded(roomCode);
		this.netClient = netClient;

		for (const peerName of netClient.getPeerNames()) {
			this.players.set(peerName, new Player(peerName));
		}
		this.thisPlayer = new ThisPlayer(level.collisionMaskUrl, netClient.name);
		this.players.set(netClient.name, this.thisPlayer);

		{
			const possessedCount = Math.max(Math.round(POSSESSED_RATIO * (this.players.size)), 1);
			const ordered = this.getNetworkOrderedPlayers();
			const possessed = new Set<Player>();
	
			while (possessed.size < possessedCount) {
				const player = ordered[this.randInt(0, ordered.length - 1)];
				possessed.add(player);
				player._possessed = true;
			}
		}

		// Propagate player kinematics at 20fps
		this.propagatePlayerKinematicsInterval = setInterval(() => {
			if (this.state === State.Day || this.state === State.Night) {
				this.netClient.send(
					'player-kinematics',
					JSON.stringify({
						origin: this.thisPlayer.origin.toJSON(),
						velocity: this.thisPlayer.velocity.toJSON()
					})
				);
			}
		}, 50);
		netClient.setOnMessage('player-kinematics', (from, msg) => {
			const obj: KinematicsMessage = JSON.parse(msg.data);
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
		this.processPlayerKinematicsInterval = setInterval(() => {
			for (const player of this.players.values()) {
				player.process(0.016);
			}
		}, 16);

		$effect(() => {
			if (this.getNetworkOrderedPlayers()[this.proposerIndex].name === this.thisPlayer.name) {
				this.sendKeyAction({ propose: { names: Array.from(this.proposals) } });
			}
		});
		$effect(() => {
			if (this.thisPlayer.currentVote !== undefined) {
				this.sendKeyAction({ vote: { value: this.thisPlayer.currentVote } });
			}
		});
	}

	public static create(netClient: NetworkClient, roomCode: string, level: Level): GameState {
		if (netClient.isHost) {
			return new HostGameState(netClient, roomCode, level);
		} else {
			return new GuestGameState(netClient, roomCode, level);
		}
	}

	public finalizeProposals(): void {
		this.sendKeyAction({ propose: { names: Array.from(this.proposals), final: true } });
	}

	public getNetworkOrderedPlayers(): Player[] {
		const players = Array.from(this.players.values());
		players.sort((a, b) => a.name.localeCompare(b.name));
		return players;
	}

	public close() {
		clearInterval(this.propagatePlayerKinematicsInterval);
		clearInterval(this.processPlayerKinematicsInterval);
		this.netClient.close();
	}

	protected setState(newState: State): boolean {
		if (this._state === newState) {
			return false;
		}
		switch (newState) {
			case State.KeyProposition:
				if (this._state === State.KeyVote) {
					this._proposerIndex = (this._proposerIndex + 1) % this.players.size;
				} else {
					this._proposerIndex = 0;
				}
				this.proposals.clear();
				break;
			case State.KeyVote:
				for (const player of this.players.values()) {
					player._currentVote = undefined;
				}
				break;
		}
		this._state = newState;
		return true;
	}

	/**
	 * Generate a random integer between min and max (inclusive)
	 * @param min
	 * @param max
	 * @returns
	 */
	protected randInt(min: number, max: number): number {
		return Math.floor(this.rng() * (max - min + 1) + min);
	}

	protected randFloat(min: number, max: number): number {
		return this.rng() * (max - min) + min;
	}

	protected sendGameState(msg: GameStateMessage) {
		if (!this.netClient.isHost) {
			console.error('Only the host can send game state messages');
			return;
		}
		this.netClient.send('game-state', JSON.stringify(msg));
	}

	protected sendKeyAction(msg: KeyActionMessage) {
		this.netClient.send('key-action', JSON.stringify(msg));
	}
}

class HostGameState extends GameState {
	protected setState(newState: State): boolean {
		if (!super.setState(newState)) {
			return false;
		}
		let endTimeMsecs = Date.now();

		switch (newState) {
			case State.FirstInfo:
				endTimeMsecs += 5000;
				break;
			case State.KeyProposition:
				endTimeMsecs += 30000;
				break;
			case State.KeyVote:
				endTimeMsecs += 50000;
				break;
			case State.KeyVoteResults:
				endTimeMsecs += 3000;
				break;
			case State.Day:
				endTimeMsecs += 120000;
				break;
			case State.Night:
				endTimeMsecs += 100000;
				break;
			case State.FinalVote:
				endTimeMsecs += 30000;
				break;
			default:
				console.error('Unknown state: ' + newState);
		}

		this._stateEndTimeMsecs = endTimeMsecs;
		this.sendGameState({ setState: { state: State.KeyVote, endTimeMsecs } });
		return true;
	}

	constructor(netClient: NetworkClient, roomCode: string, level: Level) {
		super(netClient, roomCode, level);

		netClient.setOnMessage('key-action', (from, msg) => {
			const obj: KeyActionMessage = JSON.parse(msg.data);
			if (obj.vote) {
				const player = this.players.get(from);
				if (player) {
					player._currentVote = obj.vote.value;
				} else {
					console.error('Received vote from unknown player: ' + from);
				}
				for (const player of this.players.values()) {
					if (player._currentVote === undefined) {
						return;
					}
				}
				this.setState(State.KeyVoteResults);
			} else if (obj.propose) {
				this.proposals = new SvelteSet(obj.propose.names);
				if (obj.propose.final) {
					this.setState(State.KeyVote);
				}
			}
		});
	}

	public finalizeProposals(): void {
		super.finalizeProposals();
		this.setState(State.KeyVote);
	}
}

class GuestGameState extends GameState {
	constructor(netClient: NetworkClient, roomCode: string, level: Level) {
		super(netClient, roomCode, level);

		netClient.setOnMessage('game-state', (from, msg) => {
			if (from !== netClient.hostName) {
				console.error('Received game state message from non-host: ' + from);
				return;
			}
			const msgObj: GameStateMessage = JSON.parse(msg.data);
			if (msgObj.setState) {
				this._stateEndTimeMsecs = msgObj.setState.endTimeMsecs;
				this.setState(msgObj.setState.state);
			}
		});

		netClient.setOnMessage('key-action', (from, msg) => {
			const obj: KeyActionMessage = JSON.parse(msg.data);
			if (obj.vote) {
				const player = this.players.get(from);
				if (player) {
					player._currentVote = obj.vote.value;
				} else {
					console.error('Received vote from unknown player: ' + from);
				}
			} else if (obj.propose) {
				this.proposals = new SvelteSet(obj.propose.names);
			}
		});
	}
}

export class Player {
	protected _velocity: Vector2 = $state(new Vector2(0, 0));
	protected _origin: Vector2 = $state(new Vector2(200, 260));
	protected _alive = $state(true);
	_currentVote?: boolean = $state(undefined);
	_possessed = false;

	public get currentVote() {
		return this._currentVote;
	}

	public get possessed() {
		return this._possessed;
	}

	public get origin() {
		return this._origin;
	}

	public get velocity() {
		return this._velocity;
	}

	public get alive() {
		return this._alive;
	}

	public set origin(newOrigin: Vector2) {
		this._origin = newOrigin;
	}

	public set velocity(newVelocity: Vector2) {
		this._velocity = newVelocity;
	}

	constructor(public readonly name: string) {

	}

	process(delta: number) {
		this.origin = this.origin.add(this.velocity.mul(delta));
	}
}

export class ThisPlayer extends Player {
	private collisionMask?: ImageObj;

	constructor(collisionMaskUrl: string, name: string) {
		super(name);
		ImageObj.load(collisionMaskUrl).then((img) => {
			this.collisionMask = img;
		});
	}

	public setVote(vote: boolean) {
		this._currentVote = vote;
	}

	process(delta: number) {
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