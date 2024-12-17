<script lang=ts>
	import { getContext, onDestroy, onMount } from "svelte";
	import type { AiAssistant } from "../logic/ai-assistant";

    let prompt = $state("");
    let response = $state("");
    let { visible = $bindable(false) }: { visible?: boolean } = $props();

	const aiAssistant: AiAssistant = getContext('aiAssistant');
    aiAssistant.onAIResponsePart = (part) => {
        response += part ?? "";
    };

	function keyDown(event: KeyboardEvent) {
		switch (event.code) {
			case 'Escape':
                visible = !visible;
                break;
			default:
				return; // Allow other keys to be handled
		}
		if (event.defaultPrevented) {
			return; // Do nothing if event already handled
		}
	}

	onMount(async () => {
		window.addEventListener('keydown', keyDown, true);
	});
	onDestroy(() => {
		window.removeEventListener('keydown', keyDown, true);
	});
</script>

{#if visible}
<section>
    <form onsubmit={(e) => {
        e.preventDefault();
        aiAssistant.askAI(prompt);
    }}>
        <label for="prompt">Prompt</label>
        <input name="prompt" bind:value={prompt} />
        <button onclick={() => {
            response = "";
        }}>Ask</button>
        <p>{response}</p>
    </form>
</section>
{/if}
    
<style>
	section {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		/* pointer-events: none;
		-webkit-user-drag: none;
		user-select: none;
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none; */
	}
</style>