<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	let { endTimeMsecs }: { endTimeMsecs: number } = $props();

	let timerInterval: number = 0;
	let percentage = $state(100);

	onMount(() => {
		const durationMsecs = $derived(endTimeMsecs - Date.now());

		timerInterval = setInterval(() => {
			const now = Date.now();
			if (now < endTimeMsecs) {
				const timeLeft = endTimeMsecs - now;
				percentage = (timeLeft / durationMsecs) * 100;
			} else {
				percentage = 0;
			}
		}, 16);
	});

	onDestroy(() => {
		clearInterval(timerInterval);
	});
</script>

<progress class="w-full" value={percentage} max="100"></progress>

<style>
	progress {
		position: fixed;
		bottom: 0;
		-webkit-user-drag: none;
		user-select: none;
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}
</style>
