<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import { State, type GameState } from '../logic/game-state.svelte';
	import { Vector2 } from '$lib/index.svelte';
	import Timer from '../ui/Timer.svelte';
	import Player from '../ui/Player.svelte';
	import { AreaType } from './level.svelte';
	import CryptFixes from '../ui/crypt/CryptFixes.svelte';
	import Vignette from '$lib/vignette/Vignette.svelte';

	const gameState: GameState = getContext('gameState');
	let windowWidth = $state(0);
	let windowHeight = $state(0);
	let processInterval = 0;
	// voteCameraRadius
	const bgScale = $derived.by(() => {
		const maxDimension = Math.max(windowWidth, windowHeight);
		if (
			gameState.state === State.KeyProposition ||
			gameState.state === State.KeyVote ||
			gameState.state === State.KeyVoteResults ||
			gameState.state === State.ForcedKeyVoteResults
		) {
			return maxDimension / gameState.level.voteCameraRadius;
		} else {
			return maxDimension / gameState.level.visibleRadius;
		}
	});
	const bgWidth = $derived(gameState.level.width * bgScale);
	const bgHeight = $derived(gameState.level.height * bgScale);
	let movementVector = new Vector2(0, 0);
	let cameraOrigin = $state(gameState.thisPlayer.origin);

	function keyDown(event: KeyboardEvent) {
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
			default:
				return; // Allow other keys to be handled
		}
		if (event.defaultPrevented) {
			return; // Do nothing if event already handled
		}
		gameState.thisPlayer.velocity = movementVector.normalize().mul(gameState.level.playerSpeed);

		// if (event.code !== 'Tab') {
		// 	// Consume the event so it doesn't get handled twice,
		// 	// as long as the user isn't trying to move focus away
		// 	event.preventDefault();
		// }
	}

	function keyUp(event: KeyboardEvent) {
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
			default:
				return; // Allow other keys to be handled
		}
		if (event.defaultPrevented) {
			return; // Do nothing if event already handled
		}
		gameState.thisPlayer.velocity = movementVector.normalize().mul(gameState.level.playerSpeed);
	}

	onMount(async () => {
		const onResize = () => {
			windowWidth = window.innerWidth;
			windowHeight = window.innerHeight;
		};
		window.onresize = onResize;
		onResize();
		gameState.thisPlayer.onEnterArea = (areaType) => {
			console.log('Entered area:', areaType);
		};
		gameState.thisPlayer.onExitArea = (areaType) => {
			console.log('Exited area:', areaType);
		};

		window.addEventListener('keydown', keyDown, true);
		window.addEventListener('keyup', keyUp, true);
	});

	onDestroy(() => {
		clearInterval(processInterval);
		window.removeEventListener('keydown', keyDown, true);
		window.removeEventListener('keyup', keyUp, true);
	});

	$inspect(gameState.state);
	$effect(() => {
		if (
			gameState.state === State.KeyProposition ||
			gameState.state === State.KeyVote ||
			gameState.state === State.KeyVoteResults ||
			gameState.state === State.ForcedKeyVoteResults
		) {
			cameraOrigin = gameState.level.voteOrigin;
		} else {
			cameraOrigin = gameState.thisPlayer.origin;
		}
	});
</script>

<img
	src={gameState.level.backgroundUrl}
	alt="Background"
	id="background"
	style="--width: {bgWidth}px;
        --height: {bgHeight}px;
        --left: {-cameraOrigin.x * bgScale + windowWidth / 2}px;
        --top: {-cameraOrigin.y * bgScale + windowHeight / 2}px"
/>

{#each gameState.players as [_name, player]}
	{#if player.alive}
		<Player {bgScale} {windowWidth} {windowHeight} playerObj={player} {gameState} {cameraOrigin} />
	{/if}
{/each}

{#if gameState.state === State.KeyProposition && gameState.proposals.size === gameState.requiredProposals && gameState.proposer.name === gameState.thisPlayer.name}
	<div class="fixed bottom-4 flex w-screen flex-row justify-center">
		<button
			onclick={() => {
				gameState.finalizeProposals();
			}}
		>
			Finish Proposal
		</button>
	</div>
{/if}

{#if gameState.state === State.KeyVote && gameState.thisPlayer.currentVote === undefined}
	<div class="fixed bottom-4 flex w-screen flex-row justify-center gap-4">
		<button
			onclick={() => {
				gameState.thisPlayer.setVote(true);
			}}
		>
			Yes
		</button>
		<button
			onclick={() => {
				gameState.thisPlayer.setVote(false);
			}}
		>
			No
		</button>
	</div>
{/if}
<Vignette />
<Timer endTimeMsecs={gameState.stateEndTimeMsecs} />
{#if gameState.thisPlayer.currentAreaType === AreaType.Crypt}
	<CryptFixes />
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
	img,
	button {
		-webkit-user-drag: none;
		user-select: none;
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}
</style>
