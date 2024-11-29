<script lang="ts">
	import type { Vector2 } from '$lib/index.svelte';
	import { State, type GameState, type Player } from '../game-state.svelte';

	const PLAYER_WIDTH = 11.5 * 1.7;
	const PLAYER_HEIGHT = 14.82 * 1.7;

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

	async function onPropose() {
		if (!gameState.proposals.delete(playerObj.name)) {
			if (gameState.proposals.size < gameState.requiredProposals) {
				gameState.proposals.add(playerObj.name);
			}
		}
	}

	const delta = $derived(playerObj.origin.sub(cameraOrigin));
	const style = $derived.by(() => {
		return `--width: ${PLAYER_WIDTH * bgScale}px;` +
			`--height: ${PLAYER_HEIGHT * bgScale}px;` +
			`--left: ${windowWidth / 2 - bgScale * (PLAYER_WIDTH / 2 - delta.x)}px;` +
			`--top: ${windowHeight / 2 - bgScale * (PLAYER_HEIGHT / 2 - delta.y)}px;` +
			(gameState.proposals.has(playerObj.name) ? 'filter: saturate(90%) brightness(80%) hue-rotate(90deg);' : '');
	});
</script>

{#if gameState.state === State.KeyProposition && gameState.proposer.name === gameState.thisPlayer.name}
	<button class="player hoverable" onclick={onPropose} type="button" {style}>
		<img src="/hantu/tzsbmui4vdq51-221852797.png" alt="Player" />
	</button>
{:else}
	<img
		src="/hantu/tzsbmui4vdq51-221852797.png"
		alt="Player"
		class="player"
		{style}
	/>
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
	img, button {
		-webkit-user-drag: none;
		user-select: none;
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}
</style>