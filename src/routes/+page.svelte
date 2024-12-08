<script>
	import { invalidate } from '$app/navigation';
	import Timer from '$lib/hantu/ui/Timer.svelte';
</script>

<header class="m-4 flex flex-col items-center">
	<h1 class="text-4xl font-bold">Welcome to RTC Games</h1>
	<p>
		This is a collection of real-time multiplayer games built on top of Sveltekit, Vercel, Redis,
		and of course Web-RTC
	</p>

	<nav class="mt-8 flex w-full flex-wrap justify-center gap-8 border-t-2 p-8">
		<a href="/hantu">Hantu</a>
	</nav>
</header>

<style>
	nav a {
		padding: 8px 16px;
		border: 2px solid #333;
		border-radius: 8px;
		text-decoration: none;
		color: #333;
	}
</style>
