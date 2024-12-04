import type { NetworkPeer } from '$lib/rtc';
import type { Level } from '../levels/level.svelte';
import { GameState, State, type GameStateMessage } from './game-state.svelte';

export function runBot(netClient: NetworkPeer, roomCode: string, level: Level) {
	runBotPrivate(netClient, roomCode, level).catch(console.error);
}

async function runBotPrivate(netClient: NetworkPeer, roomCode: string, level: Level) {
	const gameState = GameState.create(netClient, roomCode, level);
	// Stop bot from changing the url
	gameState.goto = () => new Promise(() => {});
	if (gameState.thisPlayer.possessed) {
		console.info(`${gameState.thisPlayer.name}: I am possessed!`);
	} else {
		console.info(`${gameState.thisPlayer.name}: I am not possessed.`);
	}
	$effect(() => {
		switch (gameState.state) {
			case State.KeyProposition:
				if (gameState.proposer.name === gameState.thisPlayer.name) {
					// This will force the host to randomly select names
					// Regular players cannot do this
					console.info(`${gameState.thisPlayer.name}: I picked my proposals.`);
					gameState.finalizeProposals();
				} else {
					console.info(`${gameState.thisPlayer.name}: Who is proposing?`);
				}
				break;
			case State.KeyVote:
				// Always agree if our name is in the proposal, otherwise random
				const vote = gameState.proposals.has(gameState.thisPlayer.name)
					? true
					: Math.random() < 0.5;
				gameState.thisPlayer.setVote(vote);
				console.info(`${gameState.thisPlayer.name}: I voted ${vote ? 'yes' : 'no'}`);
				break;
			case State.Day:
				if (gameState.thisPlayer.isKeyHolder) {
					console.info(`${gameState.thisPlayer.name}: I am the key holder.`);
				} else {
					console.info(`${gameState.thisPlayer.name}: I am not the key holder.`);
				}
				break;
		}
	});
	$effect(() => {
		if (!gameState.thisPlayer.alive) {
			console.info(`${gameState.thisPlayer.name}: I died!`);
		}
	});
}
