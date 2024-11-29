import { sfc32, sfc32StrSeeded, shuffle, Vector2 } from '$lib/index.svelte';
import type { DataChannelInit, NetworkClient } from '$lib/rtc-client';
import { Image as ImageObj } from 'image-js';
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

export type GameStateMessage = {
	endTimeMsecs: number;
	startGame?: {};
	enterKeyProposition?: {};
	enterKeyVote?: { proposals: string[] };
	enterKeyVoteResults?: { votes: Record<string, boolean> };
	enterForcedKeyVoteResults?: {};
	enterDay?: { keyHolders: string[] };
	enterNight?: {};
	// setState?: { state: State }
};
type KeyActionMessage = {
	propose?: { names: string[]; final?: boolean };
	vote?: { value: boolean };
};
type KinematicsMessage = {
	origin?: { x: number; y: number };
	velocity?: { x: number; y: number };
};

const POSSESSED_RATIO = 0.3333333;
const PROPOSAL_RATIO = 0.4;

export enum State {
	FirstInfo,
	KeyProposition,
	KeyVote,
	KeyVoteResults,
	ForcedKeyVoteResults,
	Day,
	Night,
	FinalVote
}

export abstract class GameState {
	public get state(): State {
		return this._state;
	}

	public get stateEndTimeMsecs(): State {
		return this._stateEndTimeMsecs;
	}

	public get proposerIndex(): number {
		return this._proposerIndex;
	}

	public get proposer(): Player {
		return this.getVoteOrderedPlayers()[this.proposerIndex];
	}

	public proposals: SvelteSet<string> = $state(new SvelteSet());
	public readonly thisPlayer: ThisPlayer;
	public readonly players: Map<string, Player> = new Map<string, Player>();
	public readonly requiredProposals = $derived.by(() => {
		let aliveCount = 0;
		for (const player of this.players.values()) {
			if (player.alive) {
				aliveCount++;
			}
		}
		return Math.min(Math.max(Math.round(PROPOSAL_RATIO * aliveCount), 1), this.players.size);
	});

	protected netClient: NetworkClient;
	protected syncRng: () => number;
	protected _stateEndTimeMsecs: number = $state(Date.now());
	protected readonly voteOrderSeed: number[];

	private _state: State = $state(State.FirstInfo);
	private _proposerIndex = $state(0);
	private readonly propagatePlayerKinematicsInterval: number;
	private readonly processPlayerKinematicsInterval: number;

	constructor(
		netClient: NetworkClient,
		roomCode: string,
		public readonly level: Level
	) {
		this.syncRng = sfc32StrSeeded(roomCode);
		this.netClient = netClient;

		for (const peerName of netClient.getPeerNames()) {
			this.players.set(peerName, new Player(peerName));
		}
		this.thisPlayer = new ThisPlayer(level.collisionMaskUrl, netClient.name);
		this.players.set(netClient.name, this.thisPlayer);

		{
			const possessedCount = Math.max(Math.round(POSSESSED_RATIO * this.players.size), 1);
			const ordered = this.getNetworkOrderedPlayers();
			const possessed = new Set<Player>();

			while (possessed.size < possessedCount) {
				const player = ordered[this.syncRandInt(0, ordered.length - 1)];
				possessed.add(player);
				player._possessed = true;
			}
		}
		this.voteOrderSeed = [
			this.syncRandInt(0, 0xffffffff),
			this.syncRandInt(0, 0xffffffff),
			this.syncRandInt(0, 0xffffffff),
			this.syncRandInt(0, 0xffffffff)
		];

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
			if (this.state !== State.Day && this.state !== State.Night) {
				return;
			}
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
			if (this.state === State.Day || this.state === State.Night) {
				for (const player of this.players.values()) {
					player.process(0.016);
				}
			}
		}, 16);

		$effect(() => {
			if (this.getVoteOrderedPlayers()[this.proposerIndex].name === this.thisPlayer.name) {
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

	public getVoteOrderedPlayers(): Player[] {
		const players = this.getNetworkOrderedPlayers().filter((player) => player.alive);
		const rng = sfc32(this.voteOrderSeed[0], this.voteOrderSeed[1], this.voteOrderSeed[2], this.voteOrderSeed[3]);
		shuffle(players, rng);
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
				if (this._state === State.KeyVoteResults) {
					this._proposerIndex = (this._proposerIndex + 1) % this.players.size;
				} else {
					this._proposerIndex = 0;
				}
				this.proposals.clear();

				let i = 0;
				const voteOrdered = this.getVoteOrderedPlayers();
				for (const player of voteOrdered) {
					player.origin = this.level.voteOrigin.add(
						new Vector2(this.level.voteRadius, 0).rotate((i * 2 * Math.PI) / voteOrdered.length)
					);
					i++;
				}

				break;
			case State.KeyVote:
				for (const player of this.players.values()) {
					player._currentVote = undefined;
				}
				break;
			case State.Day:
				this.proposals.clear();
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
	protected syncRandInt(min: number, max: number): number {
		return Math.floor(this.syncRng() * (max - min + 1) + min);
	}

	protected syncRandFloat(min: number, max: number): number {
		return this.syncRng() * (max - min) + min;
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
	private stateTimeoutId: number;
	private skipTimer: () => void = () => {};

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
				this.sendGameState({ enterKeyProposition: {}, endTimeMsecs });
				break;
			case State.KeyVote:
				endTimeMsecs += 50000;

				const players = Array.from(this.players.values());
				while (this.proposals.size < this.requiredProposals) {
					this.proposals.add(players[Math.floor(Math.random() * players.length)].name);
				}

				this.sendGameState({
					enterKeyVote: { proposals: Array.from(this.proposals) },
					endTimeMsecs
				});
				break;
			case State.KeyVoteResults:
				endTimeMsecs += 3000;
				const votes: Record<string, boolean> = {};

				for (const player of this.players.values()) {
					let vote = player.currentVote;
					if (vote === undefined) {
						vote = Math.random() <= 0.5;
					}
					player._currentVote = vote;
					votes[player.name] = vote;
				}

				this.sendGameState({ enterKeyVoteResults: { votes }, endTimeMsecs });
				break;
			case State.ForcedKeyVoteResults:
				endTimeMsecs += 3000;
				this.sendGameState({ enterForcedKeyVoteResults: {}, endTimeMsecs });
				break;
			case State.Day:
				endTimeMsecs += 120000;
				for (const player of this.players.values()) {
					player._isKeyHolder = this.proposals.has(player.name);
				}
				this.sendGameState({ enterDay: { keyHolders: Array.from(this.proposals) }, endTimeMsecs });
				break;
			case State.Night:
				endTimeMsecs += 100000;
				this.sendGameState({ enterNight: {}, endTimeMsecs });
				break;
			case State.FinalVote:
				// TODO
				break;
			default:
				console.error('Unknown state: ' + newState);
		}

		this._stateEndTimeMsecs = endTimeMsecs;
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
					return;
				}
				for (const player of this.players.values()) {
					if (player.alive && player._currentVote === undefined) {
						return;
					}
				}
				this.skipTimer();
			} else if (obj.propose) {
				this.proposals = new SvelteSet(obj.propose.names);
				if (obj.propose.final) {
					this.skipTimer();
				}
			}
		});

		this._stateEndTimeMsecs = Date.now() + 5000;
		this.sendGameState({ startGame: {}, endTimeMsecs: this._stateEndTimeMsecs });
		const wait = async () => {
			await new Promise<void>((resolve) => {
				this.stateTimeoutId = setTimeout(() => {
					this.skipTimer = () => {};
					resolve();
				}, this.stateEndTimeMsecs - Date.now());
				this.skipTimer = () => {
					this.skipTimer = () => {};
					clearTimeout(this.stateTimeoutId);
					resolve();
				};
			});
		};

		this.stateTimeoutId = setTimeout(async () => {
			while (true) {
				while (true) {
					this.setState(State.KeyProposition);
					await wait();
					if (this.proposerIndex == this.getVoteOrderedPlayers().length - 1) {
						this.setState(State.ForcedKeyVoteResults);
						await wait();
						break;
					} else {
						this.setState(State.KeyVote);
						await wait();
						this.setState(State.KeyVoteResults);
						await wait();
						let yays = 0;
						for (const player of this.players.values()) {
							if (player.alive && player.currentVote) {
								yays++;
							}
						}
						if (yays > this.getVoteOrderedPlayers().length / 2) {
							break;
						}
					}
				}
				this.setState(State.Day);
				await wait();
				this.setState(State.Night);
				await wait();
			}
		}, 5000);

		$effect(() => {
			if (this.state === State.KeyVote) {
				if (this.thisPlayer.currentVote !== undefined) {
					for (const player of this.players.values()) {
						if (player._currentVote === undefined) {
							return;
						}
					}
					this.skipTimer();
				}
			}
		});
	}

	public finalizeProposals(): void {
		this.skipTimer();
	}

	public close(): void {
		if (this.stateTimeoutId) {
			clearTimeout(this.stateTimeoutId);
		}
		super.close();
	}
}

class GuestGameState extends GameState {
	private gameStarted: () => void = () => {};

	constructor(netClient: NetworkClient, roomCode: string, level: Level) {
		super(netClient, roomCode, level);

		netClient.setOnMessage('game-state', (from, msg) => {
			if (from !== netClient.hostName) {
				console.error('Received game state message from non-host: ' + from);
				return;
			}
			const msgObj: GameStateMessage = JSON.parse(msg.data);
			this._stateEndTimeMsecs = msgObj.endTimeMsecs;

			if (msgObj.startGame) {
				this.gameStarted();
				this.gameStarted = () => {};
			} else if (msgObj.enterKeyProposition) {
				this.setState(State.KeyProposition);
			} else if (msgObj.enterKeyVote) {
				this.proposals = new SvelteSet(msgObj.enterKeyVote.proposals);
				this.setState(State.KeyVote);
			} else if (msgObj.enterKeyVoteResults) {
				for (const [name, vote] of Object.entries(msgObj.enterKeyVoteResults.votes)) {
					const player = this.players.get(name);
					if (player) {
						player._currentVote = vote;
					} else {
						console.error('Received vote from unknown player: ' + name);
					}
				}
				this.setState(State.KeyVoteResults);
			} else if (msgObj.enterDay) {
				for (const player of this.players.values()) {
					player._isKeyHolder = false;
				}
				for (const name of msgObj.enterDay.keyHolders) {
					const player = this.players.get(name);
					if (player) {
						player._isKeyHolder = true;
					} else {
						console.error('Received key holder from unknown player: ' + name);
					}
				}
				this.setState(State.Day);
			} else if (msgObj.enterNight) {
				this.setState(State.Night);
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
	_isKeyHolder: boolean = false;

	public get currentVote() {
		return this._currentVote;
	}

	public get isKeyHolder() {
		return this._isKeyHolder;
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

	constructor(public readonly name: string) {}

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
