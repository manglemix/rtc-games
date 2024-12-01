<script lang="ts">
	import { getContext } from 'svelte';
	import { Ending, type GameState } from '../logic/game-state.svelte';
	import Timer from './Timer.svelte';

	const gameState: GameState = getContext('gameState');
</script>

<div class="flex h-screen w-screen flex-col justify-between">
	{#if gameState.ending === Ending.Exorcist}
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
	{:else if gameState.ending === Ending.Satanic}
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
	{:else if gameState.ending === Ending.Mystery}
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
				<p>Who were the possessed?</p>
			{/if}
		</section>
	{:else if gameState.ending === Ending.Stygian}
		<section>
			{#if gameState.thisPlayer.possessed}
				<h1>They fixed the crypt, but you killed them all!</h1>
				{#each gameState.players as [name, player]}
					{#if name !== gameState.thisPlayer.name && player.possessed}
						<p>{name}</p>
					{/if}
				{/each}
				<p>It's only a matter of time before you can destroy it again...</p>
			{:else}
				<h1>You fixed the crypt, but none of you survived!</h1>
				{#each gameState.players as [name, player]}
					{#if player.possessed}
						<p>{name}</p>
					{/if}
				{/each}
			{/if}
		</section>
	{/if}
	<a href="/hantu">Back to lobby</a>
</div>

<Timer endTimeMsecs={gameState.stateEndTimeMsecs} />

<style>
	h1,
	p {
		color: white;
	}
</style>
