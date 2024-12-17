<script lang="ts">
	import { State, type GameState } from '$lib/hantu/logic/game-state.svelte';
	import { getContext, onDestroy, onMount } from 'svelte';

	const gameState: GameState = getContext('gameState');
	let opacity = $state(0);
	let interval: NodeJS.Timeout | number = 0;

	onMount(() => {
		interval = setInterval(() => {
			if (gameState.state === State.Day) {
				opacity = 1.0 - Math.min(gameState.stateEndTimeMsecs - Date.now(), 5000) / 5000;
			} else if (gameState.state === State.Night) {
				opacity = Math.min(gameState.stateEndTimeMsecs - Date.now(), 5000) / 5000;
			} else {
				opacity = 0.0;
			}
		}, 1000 / 30);
	});

	onDestroy(() => {
		clearInterval(interval);
	});
</script>

<img src="/vignette.png" alt="Vignette" style:--opacity={opacity} />

<style>
	img {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		opacity: var(--opacity);
		object-fit: cover;
		pointer-events: none;
		-webkit-user-drag: none;
		user-select: none;
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}
</style>
