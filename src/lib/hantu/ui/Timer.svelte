<script lang="ts">
	import { onMount } from 'svelte';

	let { duration }: { duration: number } = $props();

	let timerInterval = 0;
	let percentage = $state(100);
	const startTime = Date.now();
	const endTime = startTime + duration * 1000;

	onMount(() => {
		timerInterval = setInterval(() => {
			const now = Date.now();
			if (now < endTime) {
				const timeLeft = endTime - now;
				percentage = timeLeft / duration / 10;
			} else {
				clearInterval(timerInterval);
				percentage = 0;
			}
		}, 16);
	});
</script>

<progress class="w-full" value={percentage} max="100"></progress>
