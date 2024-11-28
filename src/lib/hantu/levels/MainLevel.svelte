<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import { State, type GameState } from '../game-state.svelte';
	import { Vector2 } from '$lib/index.svelte';
	import { Image as ImageObj } from "image-js";
	import Timer from '../ui/Timer.svelte';
	import type { Level } from './level.svelte';
	import Player from '../ui/Player.svelte';

	let bgWidth = $state(0);
	let bgHeight = $state(0);
	let windowWidth = $state(0);
	let windowHeight = $state(0);
	let bgScale = $state(0);
	let processInterval = 0;
	let {
		level
	}: { level: Level } = $props();

	const VISIBLE_RADIUS = 100;
	const gameState: GameState = getContext('gameState');
	const thisPlayer = gameState.getThisPlayer();
	let movementVector = new Vector2(0, 0);

	function keyDown(event: KeyboardEvent) {
		if (event.defaultPrevented) {
			return; // Do nothing if event already handled
		}

		if (gameState.state !== State.Day && gameState.state !== State.Night) {
			return;
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
		thisPlayer.velocity = movementVector.normalize().mul(20);

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
		thisPlayer.velocity = movementVector.normalize().mul(20);
	}

	onMount(async () => {
		const onResize = () => {
			windowWidth = window.innerWidth;
			windowHeight = window.innerHeight;
			const maxDimension = Math.max(windowWidth, windowHeight);
			bgScale = maxDimension / VISIBLE_RADIUS;
			bgWidth = level.width * bgScale;
			bgHeight = level.height * bgScale;
		};
		window.onresize = onResize;
		onResize();
		thisPlayer.collisionMask = await ImageObj.load(level.collisionMaskUrl);

		processInterval = setInterval(() => {
			thisPlayer.process(0.016);
			for (const player of gameState.players.values()) {
				player.process(0.016);
			}
		}, 16);

		window.addEventListener('keydown', keyDown, true);
		window.addEventListener('keyup', keyUp, true);
	});

	onDestroy(() => {
		clearInterval(processInterval);
		window.removeEventListener('keydown', keyDown, true);
		window.removeEventListener('keyup', keyUp, true);
	});

	$inspect(gameState.state);
</script>

<img
	src={level.backgroundUrl}
	alt="Background"
	id="background"
	style="--width: {bgWidth}px;
        --height: {bgHeight}px;
        --left: {-thisPlayer.origin.x * bgScale + windowWidth / 2}px;
        --top: {-thisPlayer.origin.y * bgScale + windowHeight / 2}px"
/>

<Player
	bgScale={bgScale}
	windowWidth={windowWidth}
	windowHeight={windowHeight}
	playerObj={thisPlayer}
	thisPlayerObj={thisPlayer}
/>
{#each gameState.players as [name, player]}
	<Player
		bgScale={bgScale}
		windowWidth={windowWidth}
		windowHeight={windowHeight}
		playerObj={player}
		thisPlayerObj={thisPlayer}
	/>
{/each}

<div class="flex flex-col w-screen h-screen justify-between">
	<div></div>

	{#if gameState.state === State.KeyProposition}
		<Timer duration={30} />
	{:else if gameState.state === State.KeyVote}
		<Timer duration={50} />
	{:else if gameState.state === State.Day}
		<Timer duration={120} />
	{:else if gameState.state === State.Night}
		<Timer duration={100} />
	{/if}
</div>

<style>
	#background {
		position: fixed;
		max-width: none;
		width: var(--width);
		height: var(--height);
		top: var(--top);
		left: var(--left);
		overflow: hidden;
		image-rendering: pixelated;
		image-rendering: -moz-crisp-edges;
		z-index: -2;
	}
</style>
