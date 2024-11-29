<script lang="ts">
	import type { NetworkClient } from '$lib/rtc-client';
	import { onDestroy, onMount, setContext } from 'svelte';
	import { GameState, State } from './game-state.svelte';
	import FirstInfo from './ui/FirstInfo.svelte';
	import MainLevel from './levels/MainLevel.svelte';
	import { DEBUG_LEVEL } from './levels/level.svelte';
	import Background from './Background.svelte';

	let { netClient, roomCode }: { netClient: NetworkClient; roomCode: string } = $props();
	let gameState: GameState | null = $state(null);

	onMount(() => {
		document.documentElement.requestFullscreen();
		gameState = GameState.create(netClient, roomCode, DEBUG_LEVEL);
		setContext('gameState', gameState);
	});

	onDestroy(() => {
		gameState?.close();
	});
</script>

{#if gameState}
	{#if gameState.state === State.FirstInfo}
		<Background />
		<FirstInfo />
	{:else}
		<MainLevel />
	{/if}
{/if}
