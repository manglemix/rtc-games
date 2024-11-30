import type { NetworkClient } from '$lib/rtc-client';
import type { Level } from '../levels/level.svelte';
import { GameState, State, type GameStateMessage } from './game-state.svelte';

export function runBot(netClient: NetworkClient, roomCode: string, level: Level) {
	runBotPrivate(netClient, roomCode, level).catch(console.error);
}

async function runBotPrivate(netClient: NetworkClient, roomCode: string, level: Level) {
	const gameState = GameState.create(netClient, roomCode, level);
    console.info(`${gameState.thisPlayer.name}: I am ready to play!`);
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
                const vote = Math.random() < 0.5;
                gameState.thisPlayer.setVote(vote);
                console.info(`${gameState.thisPlayer.name}: I voted ${vote ? "yes" : "no"}`);
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
}
