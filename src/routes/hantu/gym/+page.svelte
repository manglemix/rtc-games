<script lang="ts">
	import { DATA_CHANNELS } from '$lib/hantu/logic/game-state.svelte';
	import Game from '$lib/hantu/Game.svelte';

	let netClient: NetworkClient = NetworkClient.createRoom('host', DATA_CHANNELS, () => {});
	let roomCode = createRoomCode();
</script>

<Game {netClient} {roomCode} />
