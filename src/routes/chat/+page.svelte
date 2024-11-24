<script lang=ts>
	import { browser } from "$app/environment";
	import { createRoomCode, defaultConnectToRoom, defaultUploadAnswer, NetworkClient } from "$lib/rtc-client";

    let roomCode = $state("");
    let netClient: NetworkClient | null = null;
    let isHost = $state(false);
    let joining = $state(false);

    const DATA_CHANNELS = [{label: "chat"}];
</script>

<label class="inline-flex items-center cursor-pointer mt-8 ml-8">
    <input type="checkbox" class="sr-only peer" onclick={() => {
        isHost = !isHost;

        if (isHost) {
            roomCode = createRoomCode();
            netClient = NetworkClient.createRoom("HOST", DATA_CHANNELS, defaultUploadAnswer("chat", roomCode));
        } else {
            if (netClient) {
                netClient.close();
                netClient = null;
                roomCode = "";
            }
        }
    }}>
    <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
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
<form class="flex flex-col w-min m-8" onsubmit={async (event) => {
    event.preventDefault();
    joining = true;
    netClient = await defaultConnectToRoom("chat", roomCode, "JOINER", DATA_CHANNELS, () => {
        joining = false;
    });
    console.log(netClient);
    joining = false;
}}>
    <label for="roomCode">Room Code</label>
    <input disabled={joining} bind:value={roomCode} name="roomCode" placeholder="abc123">
    <button disabled={joining}>{#if joining}Joining...{:else}Join{/if}</button>
</form>
{/if}