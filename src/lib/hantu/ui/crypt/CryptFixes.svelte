<script lang="ts">
	import { getContext } from 'svelte';
	import HammerFix from './HammerFix.svelte';
	import type { GameState } from '$lib/hantu/logic/game-state.svelte';

	const SELECTION_COUNT = 1;
	const gameState: GameState = getContext('gameState');
	let count = $state(0);
	let selection = $state(0);

	function changeSelection() {
		console.info('Crypt Progress: ' + gameState.cryptProgress);
		selection = Math.floor(Math.random() * SELECTION_COUNT);
		count++;
	}
	changeSelection();
</script>

{#key count}
	{#if selection === 0}
		<HammerFix
			targetX={Math.random()}
			speed={Math.random()}
			onHit={(success) => {
				if (success) {
					gameState.addCryptProgress(0.01);
				} else {
					gameState.addCryptProgress(-0.01);
				}
				changeSelection();
			}}
		/>
	{/if}
{/key}
