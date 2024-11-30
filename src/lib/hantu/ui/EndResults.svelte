<script lang="ts">
	import { getContext } from 'svelte';
	import { Ending, type GameState } from '../logic/game-state.svelte';
	import Timer from './Timer.svelte';

	const gameState: GameState = getContext('gameState');
</script>

<div class="flex h-screen w-screen flex-col justify-between">
    {#if gameState.ending === Ending.GreatEnd}
        <section>
            {#if gameState.thisPlayer.possessed}
                <h1>All your teammates were eliminated!</h1>
                {#each gameState.players as [name, player]}
                    {#if name !== gameState.thisPlayer.name && player.possessed}
                        <p>{name}</p>
                    {/if}
                {/each}
            {:else}
                <h1>All possessed have been eliminated!</h1>
                {#each gameState.players as [name, player]}
                    {#if player.possessed}
                        <p>{name}</p>
                    {/if}
                {/each}
            {/if}
        </section>
    {:else if gameState.ending === Ending.BadEnd}
        <section>
            {#if gameState.thisPlayer.possessed}
                <h1>You killed everyone!</h1>
                {#each gameState.players as [name, player]}
                    {#if name !== gameState.thisPlayer.name && player.possessed}
                        <p>{name}</p>
                    {/if}
                {/each}
            {:else}
                <h1>Everyone was killed!</h1>
                {#each gameState.players as [name, player]}
                    {#if player.possessed}
                        <p>{name}</p>
                    {/if}
                {/each}
            {/if}
        </section>
    {:else}
        <section>
            {#if gameState.thisPlayer.possessed}
                <h1>They fixed the crypt, but you survived!</h1>
                {#each gameState.players as [name, player]}
                    {#if name !== gameState.thisPlayer.name && player.possessed}
                        <p>{name}</p>
                    {/if}
                {/each}
                <p>Try to stop them from fixing it next time.</p>
            {:else}
                <h1>You fixed the crypt, but you didn't kill all the possessed!</h1>
                {#each gameState.players as [name, player]}
                    {#if player.possessed}
                        <p>{name}</p>
                    {/if}
                {/each}
            {/if}
        </section>
    {/if}
</div>

<Timer endTimeMsecs={gameState.stateEndTimeMsecs} />

<style>
	h1,
	p {
		color: white;
	}
</style>
