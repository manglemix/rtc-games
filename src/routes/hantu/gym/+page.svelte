<script lang="ts">
	import { DATA_CHANNELS } from '$lib/hantu/logic/game-state.svelte';
	import Game from '$lib/hantu/Game.svelte';
	import { HostPeer } from '$lib/rtc-host';

	let netClient: HostPeer = new HostPeer('host', () => {}, DATA_CHANNELS);
	let roomCode = "000000";
</script>

<Game {netClient} {roomCode} />
