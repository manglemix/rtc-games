<script lang="ts">
	import type { NetworkClient } from '$lib/rtc-client';
	import { onMount, setContext } from 'svelte';
	import { GameState, State } from './game-state.svelte';
	import FirstInfo from './ui/FirstInfo.svelte';
	import MainLevel from './levels/MainLevel.svelte';
	import { DEBUG_LEVEL } from './levels/level.svelte';

	let {
		netClient,
		roomCode,
		startTime
	}: { netClient: NetworkClient; roomCode: string; startTime: number } = $props();
	let gameState = new GameState(netClient, roomCode, startTime);

	setContext('gameState', gameState);

	onMount(() => {
		document.documentElement.requestFullscreen();
	});
</script>

{#if gameState.state === State.FirstInfo}
	<FirstInfo />
{:else}
	<MainLevel
		level={DEBUG_LEVEL}
	/>
{/if}
