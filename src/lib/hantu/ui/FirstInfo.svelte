<script lang="ts">
	import { getContext } from 'svelte';
	import type { GameState } from '../game-state.svelte';
	import Timer from './Timer.svelte';

	const gameState: GameState = getContext('gameState');
</script>

<div class="flex h-screen w-screen flex-col justify-between">
	<section>
		{#if gameState.thisPlayer.possessed}
			<h1>YOU ARE POSSESSED</h1>
			{#each gameState.players as [name, _player]}
				{#if name !== gameState.thisPlayer.name}
					<p>{name}</p>
				{/if}
			{/each}
			<p>Do not reveal your identity. Kill everyone.</p>
		{:else}
			<h1>YOU ARE INNOCENT</h1>
		{/if}
	</section>
</div>

<Timer endTimeMsecs={gameState.stateEndTimeMsecs} />

<style>
	h1,
	p {
		color: white;
	}
</style>
