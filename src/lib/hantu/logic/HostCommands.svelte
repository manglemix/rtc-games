<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { HostGameState } from './game-state.svelte';

	const gameState = getContext('gameState') as HostGameState;

	onMount(() => {
		(window as any).skip = () => {
			gameState.skipTimer();
		};
		(window as any).kill = (name: string) => {
			gameState.players.get(name)!.alive = false;
		};
	});
</script>
