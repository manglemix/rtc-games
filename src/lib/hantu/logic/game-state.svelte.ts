import { sfc32, sfc32StrSeeded, shuffle, Vector2 } from '$lib/index.svelte';
import { SvelteSet } from 'svelte/reactivity';
import type { Level } from '../levels/level.svelte';
import { Player, ThisPlayer } from './player.svelte';
import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import type { DataChannelInits, NetworkPeer } from '$lib/rtc';

export const DATA_CHANNELS: DataChannelInits = {
	"game-state": {
		hostOnly: true
	},
	"key-action": {},
	"player-kinematics": {
		ordered: false,
		maxRetransmits: 0
	},
	"player-state": {},
	"crypt-state": {},
	"ollama": {
		hostOnly: true
	},
};

export enum Ending {
	Exorcist,
	Mystery,
	Satanic,
	Stygian
}

export type GameStateMessage = {
	endTimeMsecs: number;
	startGame?: {};
	enterKeyProposition?: {};
	enterKeyVote?: { proposals: string[] };
	enterKeyVoteResults?: { votes: Record<string, boolean> };
	enterForcedKeyVoteResults?: {};
	enterDay?: { keyHolders: string[] };
	enterNight?: {};
	enterFinalVote?: {};
	enterEndResults?: { ending: Ending };
};
type KeyActionMessage = {
	propose?: { names: string[]; final?: true };
	vote?: { value: boolean };
};
type KinematicsMessage = {
	origin?: { x: number; y: number };
	velocity?: { x: number; y: number };
};
type PlayerStateMessage = {
	died?: true;
	stunned?: boolean;
};
type CryptStateMessage = {
	addProgress?: number;
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
	FinalVote,
	EndResults
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

	public get cryptProgress(): number {
		return this._cryptProgress;
	}

	public get day(): number {
		return this._day;
	}

	public get proposer(): Player {
		return this.getVoteOrderedPlayers()[this.proposerIndex]!;
	}

	public get ending(): Ending | null {
		return this._ending;
	}

	public goto = goto;
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
	public readonly initialPossessedCount: number;

	protected netClient: NetworkPeer;
	protected syncRng: () => number;
	protected _stateEndTimeMsecs: number = $state(Date.now());
	protected _ending: Ending | null = $state(null);
	protected _cryptProgress = $state(0);
	protected _day = $state(0);
	protected readonly voteOrderSeed: number[];

	private _state: State = $state(State.FirstInfo);
	private _proposerIndex = $state(0);
	private readonly propagatePlayerKinematicsInterval: NodeJS.Timeout;
	private readonly processPlayerKinematicsInterval: NodeJS.Timeout;

	constructor(
		netClient: NetworkPeer,
		roomCode: string,
		public readonly level: Level
	) {
		this.syncRng = sfc32StrSeeded(roomCode);
		this.netClient = netClient;
		this.voteOrderSeed = [
			this.syncRandInt(0, 0xffffffff),
			this.syncRandInt(0, 0xffffffff),
			this.syncRandInt(0, 0xffffffff),
			this.syncRandInt(0, 0xffffffff)
		];
		if (!browser) {
			this.propagatePlayerKinematicsInterval = setInterval(() => {}, 50);
			this.processPlayerKinematicsInterval = setInterval(() => {}, 16);
			this.thisPlayer = new ThisPlayer(
				level.collisionMaskUrl,
				netClient.name,
				level.playerSprites[0]!,
				level.playerHalfDimensions[0]!
			);
			this.initialPossessedCount = 1;
			return;
		}

		for (const peerName of netClient.getPeerNames()) {
			const i = this.syncRandInt(0, level.playerSprites.length - 1);
			this.players.set(
				peerName,
				new Player(peerName, level.playerSprites[i]!, level.playerHalfDimensions[i]!)
			);
		}
		{
			const i = this.syncRandInt(0, level.playerSprites.length - 1);
			this.thisPlayer = new ThisPlayer(
				level.collisionMaskUrl,
				netClient.name,
				level.playerSprites[i]!,
				level.playerHalfDimensions[i]!
			);
			this.players.set(netClient.name, this.thisPlayer);
			$effect(() => {
				if (!this.thisPlayer.alive) {
					this.sendPlayerState({ died: true });
				}
			});
		}

		{
			this.initialPossessedCount = Math.max(Math.round(POSSESSED_RATIO * this.players.size), 1);
			const ordered = this.getNetworkOrderedPlayers();
			const possessed = new Set<Player>();

			while (possessed.size < this.initialPossessedCount) {
				const player = ordered[this.syncRandInt(0, ordered.length - 1)]!;
				possessed.add(player);
				player._possessed = true;
			}
		}

		// Propagate player kinematics at 20fps
		this.propagatePlayerKinematicsInterval = setInterval(() => {
			if (this.state === State.Day || this.state === State.Night) {
				this.netClient.broadcast(
					'player-kinematics',
					JSON.stringify({
						origin: this.thisPlayer.origin.toJSON(),
						velocity: this.thisPlayer.velocity.toJSON()
					})
				);
			}
		}, 50);
		netClient.addOnMessage('player-kinematics', (from, msg) => {
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
		netClient.addOnMessage('player-state', (from, msg) => {
			const obj: PlayerStateMessage = JSON.parse(msg.data);
			const player = this.players.get(from);
			if (player) {
				if (obj.died) {
					player.alive = false;
				}
				if (obj.stunned !== undefined) {
					player._stunned = obj.stunned;
				}
			} else {
				console.error('Received player state from unknown player: ' + from);
			}
		});
		netClient.addOnMessage('crypt-state', (_from, msg) => {
			const obj: CryptStateMessage = JSON.parse(msg.data);
			if (obj.addProgress) {
				this._cryptProgress += obj.addProgress;
				if (this._cryptProgress >= 1) {
					this._cryptProgress = 1;
				} else if (this._cryptProgress < 0) {
					this._cryptProgress = 0;
				}
			}
		});
		netClient.disconnectedCallback = (guestName) => {
			if (guestName === netClient.hostName) {
				netClient.close();
				this.goto('/hantu');
			}
			const player = this.players.get(guestName);
			if (player) {
				player.alive = false;
			} else {
				console.error('Received disconnect from unknown player: ' + guestName);
			}
		};
		this.processPlayerKinematicsInterval = setInterval(() => {
			if (this.state === State.Day || this.state === State.Night) {
				for (const player of this.players.values()) {
					player.process(0.016);
				}
			}
		}, 16);

		// Send peers our proposal if we are the proposer
		$effect(() => {
			if (this.state === State.KeyProposition) {
				if (this.getVoteOrderedPlayers()[this.proposerIndex]!.name === this.thisPlayer.name) {
					this.sendKeyAction({ propose: { names: Array.from(this.proposals) } });
				}
			}
		});
		// Send peers our vote if we have voted
		$effect(() => {
			if (this.state === State.KeyVote) {
				if (this.thisPlayer.currentVote !== undefined) {
					this.sendKeyAction({ vote: { value: this.thisPlayer.currentVote } });
				}
			}
		});
		// Send peers our stunned state if it changes
		$effect(() => {
			this.sendPlayerState({ stunned: this.thisPlayer.stunned });
		});
	}

	public static create(netClient: NetworkPeer, roomCode: string, level: Level): GameState {
		if (!browser) {
			return new NoopGameState(netClient, roomCode, level);
		}
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
		const rng = sfc32(
			this.voteOrderSeed[0]!,
			this.voteOrderSeed[1]!,
			this.voteOrderSeed[2]!,
			this.voteOrderSeed[3]!
		);
		shuffle(players, rng);
		return players;
	}

	public addCryptProgress(progress: number): void {
		this._cryptProgress += progress;

		if (this._cryptProgress >= 1) {
			this._cryptProgress = 1;
		} else if (this._cryptProgress < 0) {
			this._cryptProgress = 0;
		}

		this.sendCryptState({ addProgress: progress });
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
				this.thisPlayer.forceExitLayer();
				if (this._state === State.KeyVoteResults) {
					this._proposerIndex = (this._proposerIndex + 1) % this.players.size;
				} else {
					this._proposerIndex = 0;
					this._day++;
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
		this.netClient.broadcast('game-state', JSON.stringify(msg));
	}

	protected sendKeyAction(msg: KeyActionMessage) {
		this.netClient.broadcast('key-action', JSON.stringify(msg));
	}

	protected sendPlayerState(msg: PlayerStateMessage) {
		this.netClient.broadcast('player-state', JSON.stringify(msg));
	}

	protected sendCryptState(msg: CryptStateMessage) {
		this.netClient.broadcast('crypt-state', JSON.stringify(msg));
	}
}

export class HostGameState extends GameState {
	public skipTimer: () => void = () => {};

	private stateTimeoutId: NodeJS.Timeout | null;

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
					this.proposals.add(players[Math.floor(Math.random() * players.length)]!.name);
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

				const players2 = Array.from(this.players.values());
				while (this.proposals.size < this.requiredProposals) {
					this.proposals.add(players2[Math.floor(Math.random() * players2.length)]!.name);
				}

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
				endTimeMsecs += 100000;
				this.sendGameState({ enterFinalVote: {}, endTimeMsecs });
				break;
			case State.EndResults:
				endTimeMsecs += 20000;
				let aliveCount = 0;
				let possessedCount = 0;

				for (const player of this.players.values()) {
					if (player.alive) {
						aliveCount++;
						if (player.possessed) {
							possessedCount++;
						}
					}
				}

				if (possessedCount === 0) {
					// Regardless of how it happened, as long as the possessed players are dead, it's a great end
					this._ending = Ending.Exorcist;
				} else if (this.cryptProgress < 1) {
					// Some possessed players are still alive and the crypt is not fixed
					this._ending = Ending.Satanic;
				} else if (possessedCount === aliveCount) {
					// The crypt is fixed, but only possessed players are alive
					// This happens if all non-possessed players are killed on the night that the crypt is fixed,
					// or if the non-possessed were voted out on the final vote
					this._ending = Ending.Stygian;
				} else {
					// The crypt is fixed and at least one non-possessed player is alive
					this._ending = Ending.Mystery;
				}

				this.sendGameState({ enterEndResults: { ending: this._ending }, endTimeMsecs });
				break;
			default:
				console.error('Unknown state: ' + newState);
		}

		this._stateEndTimeMsecs = endTimeMsecs;
		return true;
	}

	public constructor(netClient: NetworkPeer, roomCode: string, level: Level) {
		super(netClient, roomCode, level);

		netClient.addOnMessage('key-action', (from, msg) => {
			const obj: KeyActionMessage = JSON.parse(msg.data);
			// Skip timer when all players have voted if another player just voted
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
				// Skip timer if a player has finalized their proposal
			} else if (obj.propose) {
				this.proposals = new SvelteSet(obj.propose.names);
				if (obj.propose.final) {
					this.skipTimer();
				}
			}
		});

		// Skip timer when all players have voted if we just voted
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

		// End the game if all possessed players are dead or the only players left are possessed
		for (const currentPlayer of this.players.values()) {
			$effect(() => {
				if (!currentPlayer.alive) {
					let aliveCount = 0;
					let possessedCount = 0;
					for (const player of this.players.values()) {
						if (player.alive) {
							aliveCount++;
							if (player.possessed) {
								possessedCount++;
							}
						}
					}
					if (possessedCount === 0 || possessedCount === aliveCount) {
						if (this.stateTimeoutId) {
							clearTimeout(this.stateTimeoutId);
						}
						this.setState(State.EndResults);
						setTimeout(() => {
							this.netClient.close();
							this.goto('/hantu');
						}, 20000);
					}
				}
			});
		}

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
					if (this.stateTimeoutId) {
						clearTimeout(this.stateTimeoutId);
					}
					resolve();
				};
			});
		};

		// The state machine
		this.stateTimeoutId = setTimeout(async () => {
			for (let day = 0; day < 5; day++) {
				if (this._cryptProgress >= 1) {
					this.setState(State.FinalVote);
					await wait();
					break;
				}
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
			this.setState(State.EndResults);
			await wait();
			this.netClient.close();
			this.goto('/hantu');
			return;
		}, 5000);
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

	constructor(netClient: NetworkPeer, roomCode: string, level: Level) {
		super(netClient, roomCode, level);

		netClient.clearOnMessageForChannel('game-state');
		netClient.addOnMessage('game-state', (from, msg) => {
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
			} else if (msgObj.enterFinalVote) {
				// TODO: Implement
				this.setState(State.FinalVote);
			} else if (msgObj.enterEndResults) {
				this._ending = msgObj.enterEndResults.ending;
				this.setState(State.EndResults);
			}
		});

		netClient.addOnMessage('key-action', (from, msg) => {
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

class NoopGameState extends GameState {}
