<script lang="ts">
	import {
		createRoomCode,
		defaultAcceptOffers,
		defaultAdvertise,
		defaultConnectToRoom,
		defaultUploadAnswer,
		NetworkClient
	} from '$lib/rtc-client';

	let roomCode = $state('');
	let netClient: NetworkClient | null = $state(null);
	let isHost = $state(false);
	let joining = $state(false);
	let interval: number | null = null;
	let yourName = $state('');
	let message = $state('');
	let messages: { from: string; message: string }[] = $state([]);

	$effect(() => {
		if (netClient) {
			netClient.setOnMessage('chat', (from, message) => {
				messages.push({ from, message: message.data });
			});
		} else {
			messages = [];
		}
	});

	const DATA_CHANNELS = [{ label: 'chat' }];
</script>

<label class="ml-8 mt-8 inline-flex cursor-pointer items-center">
	<input
		type="checkbox"
		class="peer sr-only"
		onclick={() => {
			isHost = !isHost;

			if (isHost) {
				roomCode = createRoomCode();
				netClient = NetworkClient.createRoom(
					yourName,
					DATA_CHANNELS,
					defaultUploadAnswer('chat', roomCode),
					defaultAdvertise('chat', roomCode)
				);
				interval = defaultAcceptOffers('chat', roomCode, netClient);
			} else {
				if (netClient) {
					netClient.close();
					netClient = null;
					roomCode = '';
				}
			}
		}}
	/>
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
<input
	class="m-8"
	type="text"
	bind:value={yourName}
	placeholder="Your Name"
	disabled={netClient !== null}
/>
{#if isHost}
	<h1>Room Code: <code>{roomCode}</code></h1>
{:else if netClient === null}
	<form
		class="m-8 flex w-min flex-col"
		onsubmit={async (event) => {
			event.preventDefault();
			joining = true;
			netClient = await defaultConnectToRoom('chat', roomCode, yourName, DATA_CHANNELS, () => {
				joining = false;
				roomCode = '';
				netClient = null;
			});
			joining = false;
		}}
	>
		<label for="roomCode">Room Code</label>
		<input disabled={joining} bind:value={roomCode} name="roomCode" placeholder="abc123" />
		<button disabled={joining}
			>{#if joining}Joining...{:else}Join{/if}</button
		>
	</form>
{/if}

{#if isHost || netClient !== null}
	<section class="flex flex-col gap-4">
		{#each messages as { from, message }}
			<div class="flex gap-2">
				<span class="font-bold">{from}:</span>
				<span>{message}</span>
			</div>
		{/each}
		<form
			class="flex gap-2"
			onsubmit={async (event) => {
				event.preventDefault();
				if (netClient) {
					netClient.send('chat', message);
					messages.push({ from: yourName, message });
					message = '';
				}
			}}
		>
			<input class="flex-1" bind:value={message} placeholder="Type a message..." />
			<button>Send</button>
		</form>
	</section>
{/if}
