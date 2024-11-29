<script lang="ts">
	import type { Vector2 } from '$lib/index.svelte';
	import { State, type GameState } from '../logic/game-state.svelte';
	import type { Player } from '../logic/player.svelte';

	let {
		bgScale,
		windowWidth,
		windowHeight,
		playerObj,
		gameState,
		cameraOrigin
	}: {
		bgScale: number;
		windowWidth: number;
		windowHeight: number;
		playerObj: Player;
		gameState: GameState;
		cameraOrigin: Vector2;
	} = $props();
	const PLAYER_HALF_WIDTH = playerObj.spriteHalfDimensions.x;
	const PLAYER_HALF_HEIGHT = playerObj.spriteHalfDimensions.y;

	async function onPropose() {
		if (!gameState.proposals.delete(playerObj.name)) {
			if (gameState.proposals.size < gameState.requiredProposals) {
				gameState.proposals.add(playerObj.name);
			}
		}
	}

	const delta = $derived(playerObj.origin.sub(cameraOrigin));
	const style = $derived.by(() => {
		return (
			`--width: ${PLAYER_HALF_WIDTH * 2 * bgScale}px;` +
			`--height: ${PLAYER_HALF_HEIGHT * 2 * bgScale}px;` +
			`--left: ${windowWidth / 2 - bgScale * (PLAYER_HALF_WIDTH - delta.x)}px;` +
			`--top: ${windowHeight / 2 - bgScale * (PLAYER_HALF_HEIGHT - delta.y)}px;` +
			(gameState.proposals.has(playerObj.name)
				? 'filter: saturate(90%) brightness(80%) hue-rotate(90deg);'
				: '')
		);
	});
</script>

{#if gameState.state === State.KeyProposition && gameState.proposer.name === gameState.thisPlayer.name}
	<button class="player hoverable" onclick={onPropose} type="button" {style}>
		<img src={playerObj.spriteUrl} alt="Player" />
	</button>
{:else}
	<img src={playerObj.spriteUrl} alt="Player" class="player" {style} />
{/if}

<style>
	.player {
		position: fixed;
		max-width: none;
		width: var(--width);
		height: var(--height);
		top: var(--top);
		left: var(--left);
		overflow: hidden;
		image-rendering: pixelated;
		image-rendering: -moz-crisp-edges;
		z-index: -1;
	}
	.hoverable:hover {
		cursor: pointer;
		filter: saturate(90%) brightness(80%);
	}
	.hoverable:active {
		cursor: pointer;
		filter: saturate(80%) brightness(70%);
	}
	img,
	button {
		-webkit-user-drag: none;
		user-select: none;
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}
	button img {
		width: 100%;
		height: 100%;
	}
</style>
