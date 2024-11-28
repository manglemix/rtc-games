<script lang="ts">
	import Background from '$lib/hantu/Background.svelte';
	import { DATA_CHANNELS } from '$lib/hantu/game-state.svelte';
	import Game from '$lib/hantu/Game.svelte';
	import { createRoomCode, NetworkClient } from '$lib/rtc-client';

	let netClient: NetworkClient = NetworkClient.createRoom(
		'host',
		DATA_CHANNELS,
		() => {}
	);
	let roomCode = createRoomCode();
</script>

<Background />
<Game netClient={netClient} {roomCode} />
