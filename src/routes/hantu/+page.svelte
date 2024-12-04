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
	let name = $state('');
	let isHost = $state(false);
	let roomCode = $state('');
	let joining = $state(false);
	let peerNames: SvelteSet<string> = $state(new SvelteSet());

	function isNameValid() {
		return name.length > 1 && name.length <= 12 && name.match(/^[a-zA-Z0-9]+$/);
	}

	onMount(() => {
		if (window.document.fullscreenElement) {
			document.exitFullscreen();
		}
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
		<label for="name">Name:</label>
		<input
			type="text"
			id="name"
			disabled={joining || netClient !== null}
			bind:value={name}
			maxlength="12"
		/>

		<label class="ml-8 mt-8 inline-flex cursor-pointer items-center">
			<input type="checkbox" class="peer sr-only" onclick={() => (isHost = !isHost)} />
			<div
				class="peer relative h-6 w-11 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rtl:peer-checked:after:-translate-x-full dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800"
			></div>
			<span class="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
				{#if isHost}
					Host
				{:else}
					Join
				{/if}
			</span>
		</label>
		{#if isHost}
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
			{:else}
				<button
					onclick={async () => {
						if (!isNameValid()) {
							alert('Please enter a valid name');
							return;
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
					}}>Create Game</button
				>
			{/if}
		{:else if netClient}
			<h2>Waiting for host to start the game</h2>
			{#each peerNames as peer}
				<p>{peer}</p>
			{/each}
			<button
				onclick={() => {
					netClient!.close();
					netClient = null;
				}}>Exit Lobby</button
			>
		{:else}
			<label for="roomCode">Room Code:</label>
			<input
				disabled={joining || netClient !== null}
				type="text"
				id="roomCode"
				maxlength="6"
				bind:value={roomCode}
			/>
			<button
				disabled={joining}
				onclick={async () => {
					if (!isNameValid()) {
						alert('Please enter a valid name');
						return;
					}
					if (roomCode.length !== 6 || !roomCode.match(/^[a-zA-Z0-9]+$/)) {
						alert('Please enter a valid room code');
						return;
					}
					joining = true;
					const tmp = await joinRoom('hantu', name, roomCode, DATA_CHANNELS);
					joining = false;
					if (tmp === null) {
						alert('Failed to join game');
						return;
					}
					netClient = tmp.peer;
					peerNames = new SvelteSet(netClient.getPeerNames());
					netClient.connectedCallback = (newPeerName) => {
						peerNames.add(newPeerName);
					};
					netClient.disconnectedCallback = (peerName) => {
						if (peerName === tmp.hostName) {
							netClient!.close();
							netClient = null;
						}
						peerNames.delete(peerName);
					};
					netClient.addOnMessage('game-state', (_from, message) => {
						const obj: GameStateMessage = JSON.parse(message.data);
						if (obj.startGame) {
							onMainMenu = false;
						}
					});
				}}
				>{#if joining}Joining...{:else}Join Game{/if}</button
			>
		{/if}
	</section>
{:else}
	<Game netClient={netClient!} {roomCode} {bots} />
{/if}

<style>
	h1,
	p,
	button,
	label {
		color: white;
	}
</style>
