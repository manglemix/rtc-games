<script lang="ts">
	import Background from '$lib/hantu/Background.svelte';
	import { DATA_CHANNELS, type GameStateMessage } from '$lib/hantu/logic/game-state.svelte';
	import Game from '$lib/hantu/Game.svelte';
	import { createRoomCode, NetworkClient } from '$lib/rtc-client';
	import {
		defaultAcceptOffers,
		defaultAdvertise,
		defaultClearAdvertise,
		defaultConnectToRoom,
		defaultUploadAnswer
	} from '$lib/rtc-defaults';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';

	const name = 'host';
	const roomCode = createRoomCode();
	let botIndex = 0;
	let bots: NetworkClient[] = $state([]);
	let netClient: NetworkClient | null = $state(null);
	let acceptInterval: number | null = null;
	let onMainMenu = $state(true);
	let peerNames: SvelteSet<string> = $state(new SvelteSet());

	onMount(() => {
		if (window.document.fullscreenElement) {
			document.exitFullscreen();
		}
		netClient = NetworkClient.createRoom(
			name,
			DATA_CHANNELS,
			defaultUploadAnswer('hantu', roomCode)
		);
		const advertise = defaultAdvertise('hantu', roomCode);
		advertise(netClient.advertiseAsHost());
		netClient.onConnection = (newPeerName) => {
			peerNames.add(newPeerName);
			advertise(netClient!.advertiseAsHost());
		};
		netClient.onGuestDisconnect = (peerName) => {
			peerNames.delete(peerName);
			advertise(netClient!.advertiseAsHost());
		};
		acceptInterval = defaultAcceptOffers('hantu', roomCode, netClient);
	});

	onDestroy(() => {
		if (netClient) {
			netClient.close();
		}
		if (acceptInterval) {
			clearInterval(acceptInterval);
		}
	});
</script>

{#if onMainMenu}
	<Background />
	<h1>HANTU</h1>
	<p>A social deduction game inspired by MindNight, Among Us, and Werewolf</p>
	<section id="main-menu" class="flex flex-col items-center">
		<h1>Room Code: {roomCode}</h1>
		{#each peerNames as peer}
			<p>{peer}</p>
		{/each}
		<button
			onclick={() => {
				defaultClearAdvertise('hantu', roomCode);
				clearInterval(acceptInterval!);
				acceptInterval = null;
				onMainMenu = false;
				netClient!.onConnection = (newPeerName) => {
					console.error('Unexpected connection from', newPeerName);
				};
				netClient!.onGuestDisconnect = (peerName) => {
					peerNames.delete(peerName);
				};
			}}>Start Game</button
		>
		<button
			onclick={() => {
				netClient!.onGuestDisconnect = () => {};
				netClient!.close();
				clearInterval(acceptInterval!);
				acceptInterval = null;
				goto('/hantu');
			}}>Close Room</button
		>
		<button
			onclick={async () => {
				const newNetClient = await defaultConnectToRoom(
					'hantu',
					roomCode,
					`bot${botIndex++}`,
					DATA_CHANNELS
				);
				if (newNetClient === null) {
					console.error('Failed to connect to room as bot');
					return;
				}
				bots.push(newNetClient);
			}}>Add Bot</button
		>
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
