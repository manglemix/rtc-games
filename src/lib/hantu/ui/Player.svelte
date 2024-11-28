<script lang=ts>
	import type { Player } from "../game-state.svelte";

    const PLAYER_WIDTH = 23.00 / 2;
    const PLAYER_HEIGHT = 29.64 / 2;

	let {
		bgScale,
        windowWidth,
        windowHeight,
        playerObj,
        thisPlayerObj
	}: { bgScale: number, windowWidth: number, windowHeight: number, playerObj: Player, thisPlayerObj: Player } = $props();

    const delta = $derived(playerObj.origin.sub(thisPlayerObj.origin));
</script>

<img
    src="/hantu/tzsbmui4vdq51-221852797.png"
    alt="Player"
    id="player"
    style="--width: {PLAYER_WIDTH * bgScale}px;
        --height: {PLAYER_HEIGHT * bgScale}px;
        --left: {windowWidth / 2 - bgScale * (PLAYER_WIDTH / 2 - delta.x)}px;
        --top: {windowHeight / 2 - bgScale * (PLAYER_HEIGHT / 2 - delta.y)}px"
/>

<style>
	#player {
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
</style>
