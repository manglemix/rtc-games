<script lang="ts">
	import type { NetworkClient } from '$lib/rtc-client';
	import { onDestroy, onMount, setContext } from 'svelte';
	import { GameState, State } from './game-state.svelte';
	import FirstInfo from './ui/FirstInfo.svelte';
	import MainLevel from './levels/MainLevel.svelte';
	import { DEBUG_LEVEL } from './levels/level.svelte';

	let {
		netClient,
		roomCode,
	}: { netClient: NetworkClient; roomCode: string } = $props();
	let gameState = GameState.create(netClient, roomCode, DEBUG_LEVEL);

	setContext('gameState', gameState);

	onMount(() => {
		document.documentElement.requestFullscreen();
	});

	onDestroy(() => {
		gameState.close();
		document.exitFullscreen();
	});
</script>

{#if gameState.state === State.FirstInfo}
	<FirstInfo />
{:else}
	<MainLevel
		level={DEBUG_LEVEL}
	/>
{/if}
