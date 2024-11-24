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
	let netClient: NetworkClient | null = null;
	let isHost = $state(false);
	let joining = $state(false);
    let interval: number | null = null;

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
					'HOST',
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
{#if isHost}
	<h1>Room Code: <code>{roomCode}</code></h1>
{:else}
	<form
		class="m-8 flex w-min flex-col"
		onsubmit={async (event) => {
			event.preventDefault();
			joining = true;
			netClient = await defaultConnectToRoom('chat', roomCode, 'JOINER', DATA_CHANNELS, () => {
				joining = false;
			});
			console.log(netClient);
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
