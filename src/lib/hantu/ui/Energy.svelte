<script lang="ts">
	import { getContext } from 'svelte';
	import { State, type GameState } from '../logic/game-state.svelte';

	const gameState: GameState = getContext('gameState');
</script>

{#if gameState.state === State.Day || gameState.state === State.Night}
	<progress
		value={gameState.thisPlayer.energy * 100}
		max="100"
		style:--color={`rgb(${100 - gameState.thisPlayer.energy * 100}% ${gameState.thisPlayer.energy * 100}% 0%)`}
	></progress>
{/if}

<style>
	progress {
		position: fixed;
		width: 4rem;
		bottom: 4rem;
		right: 0rem;
		-webkit-user-drag: none;
		user-select: none;
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
		rotate: -90deg;
	}
	progress[value]::-webkit-progress-value {
		background-image: -webkit-linear-gradient(var(--color), var(--color));

		background-size:
			35px 20px,
			100% 100%,
			100% 100%;
	}
</style>
