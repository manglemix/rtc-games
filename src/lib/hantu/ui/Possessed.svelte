<script lang="ts">
	import { getContext } from 'svelte';
	import { State, type GameState } from '../logic/game-state.svelte';
	import { AreaType } from '../levels/level.svelte';

	const gameState: GameState = getContext('gameState');
</script>

{#if gameState.thisPlayer.haunting}
    {#if !gameState.thisPlayer.hauntInitializing}
        <div id="haunt" class="align-center fixed top-32 flex h-screen w-screen flex-col justify-center">
            <button
                onclick={() => {
                    if (gameState.killWithinRadius(gameState.thisPlayer.origin, 100).length > 0) {
                        gameState.thisPlayer.haunting = false;
                    }
                }}
                type="button">ATTACK</button
            >
        </div>
    {/if}
{:else if gameState.canHaunt && gameState.thisPlayer.currentAreaType === AreaType.Bedroom && !gameState.thisPlayer.haunted && !gameState.thisPlayer.haunting}
    <div id="haunt" class="align-center fixed top-32 flex h-screen w-screen flex-col justify-center">
        <button
            onclick={() => {
                gameState.thisPlayer.haunting = true;
            }}
            type="button">HAUNT</button
        >
    </div>
{/if}

<style>
	#haunt button {
		font-size: 2rem;
		font-weight: bold;
	}
</style>
