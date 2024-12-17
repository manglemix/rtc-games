<script lang="ts">
	import { onDestroy, onMount, setContext } from 'svelte';
	import { GameState, State } from './logic/game-state.svelte';
	import FirstInfo from './ui/FirstInfo.svelte';
	import MainLevel from './levels/MainLevel.svelte';
	import { DEBUG_LEVEL } from './levels/level.svelte';
	import Background from './Background.svelte';
	import { runBot } from './logic/bot.svelte';
	import HostCommands from './logic/HostCommands.svelte';
	import EndResults from './ui/EndResults.svelte';
	import { AiAssistant } from './logic/ai-assistant';
	import type { NetworkPeer } from '$lib/rtc';

	let {
		netClient,
		roomCode,
		bots
	}: { netClient: NetworkPeer; roomCode: string; bots?: NetworkPeer[] } = $props();
	let gameState = GameState.create(netClient, roomCode, DEBUG_LEVEL);
	let aiAssistant = AiAssistant.create(gameState, netClient);
	setContext('gameState', gameState);
	setContext('aiAssistant', aiAssistant);

	onMount(() => {
		document.documentElement.requestFullscreen();
		if (bots) {
			bots.forEach((bot) => {
				runBot(bot, roomCode, DEBUG_LEVEL);
			});
		}
	});

	onDestroy(() => {
		gameState?.close();
	});
</script>

{#if gameState.ending !== null}
	<Background />
	<EndResults />
{:else}
	{#if netClient.isHost}
		<HostCommands />
	{/if}
	{#if gameState}
		{#if gameState.state === State.FirstInfo}
			<Background />
			<FirstInfo />
		{:else}
			<MainLevel />
		{/if}
	{/if}
{/if}
