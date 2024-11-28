<script lang="ts">
	import type { Vector2 } from '$lib/index.svelte';
	import { State, type GameState, type Player } from '../game-state.svelte';

	const PLAYER_WIDTH = 11.5;
	const PLAYER_HEIGHT = 14.82;

	let {
		bgScale,
		windowWidth,
		windowHeight,
		playerObj,
		gameState,
		onPropose,
		highlightGreen,
		cameraOrigin
	}: {
		bgScale: number;
		windowWidth: number;
		windowHeight: number;
		playerObj: Player;
		gameState: GameState;
		onPropose?: () => void;
		highlightGreen?: boolean;
		cameraOrigin: Vector2;
	} = $props();

	const delta = $derived(playerObj.origin.sub(cameraOrigin));
	const style = $derived(
		`--width: ${PLAYER_WIDTH * bgScale}px;` +
			`--height: ${PLAYER_HEIGHT * bgScale}px;` +
			`--left: ${windowWidth / 2 - bgScale * (PLAYER_WIDTH / 2 - delta.x)}px;` +
			`--top: ${windowHeight / 2 - bgScale * (PLAYER_HEIGHT / 2 - delta.y)}px;` +
			(highlightGreen ? 'filter: saturate(90%) brightness(80%) hue-rotate(90deg);' : '')
	);
</script>

{#if gameState.state === State.KeyProposition}
	<button
		class="player hoverable"
		onclick={onPropose}
		type="button"
		{style}
	>
		<img
			src="/hantu/tzsbmui4vdq51-221852797.png"
			alt="Player"
		/>
	</button>
{:else}
	<img
		src="/hantu/tzsbmui4vdq51-221852797.png"
		alt="Player"
		class="player"
		style="--width: {PLAYER_WIDTH * bgScale}px;
			--height: {PLAYER_HEIGHT * bgScale}px;
			--left: {windowWidth / 2 - bgScale * (PLAYER_WIDTH / 2 - delta.x)}px;
			--top: {windowHeight / 2 - bgScale * (PLAYER_HEIGHT / 2 - delta.y)}px"
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
</style>
