<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import type { GameState } from '../game-state.svelte';
	import { Vector2 } from '$lib';

	let bgWidth = $state(0);
	let bgHeight = $state(0);
	let windowWidth = $state(0);
	let windowHeight = $state(0);
	let bgScale = $state(0);
	let processInterval = 0;
	let {
		backgroundUrl,
		backgroundWidth,
		backgroundHeight
	}: { backgroundUrl: string; backgroundWidth: number; backgroundHeight: number } = $props();

	const VISIBLE_RADIUS = 100;
	const gameState: GameState = getContext('gameState');
	const player = gameState.player;
	let movementVector = new Vector2(0, 0);

	function keyDown(event: KeyboardEvent) {
		if (event.defaultPrevented) {
			return; // Do nothing if event already handled
		}

		switch (event.code) {
			case 'KeyS':
			case 'ArrowDown':
				movementVector.y = 1;
				break;
			case 'KeyW':
			case 'ArrowUp':
				movementVector.y = -1;
				break;
			case 'KeyA':
			case 'ArrowLeft':
				movementVector.x = -1;
				break;
			case 'KeyD':
			case 'ArrowRight':
				movementVector.x = 1;
				break;
		}
		player.setVelocity(movementVector.normalize().mul(20));

		if (event.code !== 'Tab') {
			// Consume the event so it doesn't get handled twice,
			// as long as the user isn't trying to move focus away
			event.preventDefault();
		}
	}

	function keyUp(event: KeyboardEvent) {
		if (event.defaultPrevented) {
			return; // Do nothing if event already handled
		}

		let velocity = player.velocity;
		switch (event.code) {
			case 'KeyS':
			case 'ArrowDown':
				movementVector.y = 0;
				break;
			case 'KeyW':
			case 'ArrowUp':
				movementVector.y = -0;
				break;
			case 'KeyA':
			case 'ArrowLeft':
				movementVector.x = -0;
				break;
			case 'KeyD':
			case 'ArrowRight':
				movementVector.x = 0;
				break;
		}
		player.setVelocity(movementVector.normalize().mul(20));
	}

	onMount(() => {
		const onResize = () => {
			windowWidth = window.innerWidth;
			windowHeight = window.innerHeight;
			const maxDimension = Math.max(windowWidth, windowHeight);
			bgScale = maxDimension / VISIBLE_RADIUS;
			bgWidth = backgroundWidth * bgScale;
			bgHeight = backgroundHeight * bgScale;
		};
		window.onresize = onResize;
		onResize();

		processInterval = setInterval(() => {
			player.process(0.016);
		}, 16);

		window.addEventListener('keydown', keyDown, true);
		window.addEventListener('keyup', keyUp, true);
	});

	onDestroy(() => {
		clearInterval(processInterval);
		window.removeEventListener('keydown', keyDown, true);
		window.removeEventListener('keyup', keyUp, true);
	});
</script>

<img
	src={backgroundUrl}
	alt="Background"
	id="background"
	style="--bg-width: {bgWidth}px;
        --bg-height: {bgHeight}px;
        --left: {-player.origin.x * bgScale + windowWidth / 2}px;
        --top: {-player.origin.y * bgScale + windowHeight / 2}px"
/>

<style>
	#background {
		position: fixed;
		max-width: none;
		width: var(--bg-width);
		height: var(--bg-height);
		top: var(--top);
		left: var(--left);
		overflow: hidden;
		image-rendering: pixelated;
		image-rendering: -moz-crisp-edges;
		image-rendering: crisp-edges;
	}
</style>
