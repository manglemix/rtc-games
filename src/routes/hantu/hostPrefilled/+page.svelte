<script lang="ts">
	import Background from '$lib/hantu/Background.svelte';
	import { DATA_CHANNELS, type GameStateMessage } from '$lib/hantu/logic/game-state.svelte';
	import Game from '$lib/hantu/Game.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { onDestroy, onMount } from 'svelte';
	import type { NetworkPeer } from '$lib/rtc';
	import { createRoom, joinRoom } from '$lib/rtc-defaults';

	let closeRoom: (() => void) | null = null;
	let netClient: NetworkPeer | null = $state(null);
	let onMainMenu = $state(true);
	let botIndex = 0;
	let bots: NetworkPeer[] = $state([]);
	const name = 'host';
	let roomCode = $state('');
	let peerNames: SvelteSet<string> = $state(new SvelteSet());

	onMount(async () => {
		if (window.document.fullscreenElement) {
			document.exitFullscreen();
		}

		const tmp = await createRoom('hantu', name, DATA_CHANNELS);
		roomCode = tmp.roomCode;
		netClient = tmp.peer;
		closeRoom = tmp.closeRoom;
		netClient.connectedCallback = (newPeerName) => {
			peerNames.add(newPeerName);
		};
		netClient.disconnectedCallback = (peerName) => {
			peerNames.delete(peerName);
		};
	});

	onDestroy(() => {
		if (netClient) {
			netClient.close();
		}
	});
</script>

{#if onMainMenu}
	<Background />
	<h1>HANTU</h1>
	<p>A social deduction game inspired by MindNight, Among Us, and Werewolf</p>
	<section id="main-menu" class="flex flex-col items-center">
		{#if netClient}
			<h1>Room Code: {roomCode}</h1>
			{#each peerNames as peer}
				<p>{peer}</p>
			{/each}
			<button
				onclick={() => {
					closeRoom!();
					onMainMenu = false;
					netClient!.connectedCallback = (newPeerName) => {
						console.error('Unexpected connection from', newPeerName);
					};
					netClient!.disconnectedCallback = (peerName) => {
						peerNames.delete(peerName);
					};
				}}>Start Game</button
			>
			<button
				onclick={() => {
					closeRoom!();
					roomCode = '';
					netClient!.disconnectedCallback = () => {};
					netClient!.close();
					netClient = null;
				}}>Close Room</button
			>
			<button
				onclick={async () => {
					const tmp = await joinRoom('hantu', `bot${botIndex++}`, roomCode, DATA_CHANNELS);
					if (tmp === null) {
						console.error('Failed to connect to room as bot');
						return;
					}
					bots.push(tmp.peer);
				}}>Add Bot</button
			>
		{/if}
	</section>
{:else}
	<Game netClient={netClient!} {roomCode} {bots} />
{/if}

<style>
	h1,
	p,
	button {
		color: white;
	}
</style>
