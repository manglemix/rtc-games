<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import { State, type GameState } from '../game-state.svelte';
	import { Vector2 } from '$lib/index.svelte';
	import { Image as ImageObj } from "image-js";
	import Timer from '../ui/Timer.svelte';
	import type { Level } from './level.svelte';
	import Player from '../ui/Player.svelte';
	import { SvelteSet } from 'svelte/reactivity';

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
		gameState.thisPlayer.velocity = movementVector.normalize().mul(20);

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
		gameState.thisPlayer.velocity = movementVector.normalize().mul(20);
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
        --left: {-gameState.thisPlayer.origin.x * bgScale + windowWidth / 2}px;
        --top: {-gameState.thisPlayer.origin.y * bgScale + windowHeight / 2}px"
/>

{#each gameState.players as [name, player]}
	<Player
		bgScale={bgScale}
		windowWidth={windowWidth}
		windowHeight={windowHeight}
		playerObj={player}
		{gameState}
		onPropose={() => {
			if (!gameState.proposals.delete(name)) {
				if (gameState.proposals.size < gameState.requiredProposals) {
					gameState.proposals.add(name);
				}
			}
		}}
		highlightGreen={gameState.proposals.has(name)}
		cameraOrigin={gameState.thisPlayer.origin}
	/>
{/each}

{#if gameState.state === State.KeyProposition && gameState.proposals.size === gameState.requiredProposals}
	<div class="flex flex-row justify-center w-screen fixed bottom-4">
		<button onclick={() => {
			gameState.finalizeProposals();
		}}>
			Finish
		</button>
	</div>
{/if}

{#if gameState.state === State.KeyProposition}
	<Timer duration={30} />
{:else if gameState.state === State.KeyVote}
	<Timer duration={50} />
{:else if gameState.state === State.Day}
	<Timer duration={120} />
{:else if gameState.state === State.Night}
	<Timer duration={100} />
{/if}

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
