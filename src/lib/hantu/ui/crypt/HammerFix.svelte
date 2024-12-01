<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	const tolerance = 3;
	let {
		targetX,
		speed,
		onHit
	}: { targetX: number; speed: number; onHit: (success: boolean) => void } = $props();

	const startTime = Date.now();
	let x = $state(0);
	let interval = 0;

	function keyDown(event: KeyboardEvent) {
		if (event.defaultPrevented) {
			return; // Do nothing if event already handled
		}

		switch (event.code) {
			case 'Space':
				onHit(Math.abs(x - targetX * 100) <= tolerance);
				break;
		}
	}

	onMount(() => {
		interval = setInterval(() => {
			const delta = (Date.now() - startTime) * (0.09 * speed + 0.01);
			const iteration = Math.floor(delta / 100);

			if (iteration % 2 === 0) {
				x = delta % 100;
			} else {
				x = 100 - (delta % 100);
			}
		}, 1000 / 60);
		window.addEventListener('keydown', keyDown, true);
	});

	onDestroy(() => {
		clearInterval(interval);
		window.removeEventListener('keydown', keyDown, true);
	});
</script>

<div id="bar" style:--targetX={`${targetX * 100}%`}>
	<div id="pointer" style:--x={`${x}%`}></div>
	<div id="target-pointer" style:--x={`${targetX * 100}%`}></div>
</div>

<style>
	#bar {
		position: fixed;
		bottom: 3rem;
		width: 60vw;
		left: 20vw;
		height: 4rem;
		background: linear-gradient(
			90deg,
			red,
			yellow max(0%, calc(var(--targetX) - 10%)),
			green var(--targetX),
			yellow min(100%, calc(var(--targetX) + 10%)),
			red
		);
	}
	#pointer {
		position: absolute;
		height: 100%;
		width: 0.3rem;
		left: var(--x);
		background: black;
	}
	#target-pointer {
		position: absolute;
		height: 100%;
		width: 0.3rem;
		left: var(--x);
		background: white;
	}
</style>
