<script lang="ts">
	import type { NetworkClient } from '$lib/rtc-client';
	import { setContext } from 'svelte';
	import { GameState } from './game-state';
	import FirstInfo from './menus/FirstInfo.svelte';
	import { browser } from '$app/environment';

	let { netClient }: { netClient: NetworkClient } = $props();
	let gameState = new GameState(netClient);
	let pageId = $state('first-info');

	setContext('gameState', gameState);

	if (browser) {
		document.documentElement.requestFullscreen();
	}
</script>

{#if pageId === 'first-info'}
	<FirstInfo />
{:else}
	<output>Unknown pageId: {pageId}. Please report.</output>
	<a href="/">Return to Home</a>
{/if}
