<script lang=ts>
	import { browser } from "$app/environment";
	import { enhance } from "$app/forms";
	import type { ActionData } from "./$types";

	let { form }: { form: ActionData } = $props();
</script>

<form method="POST" use:enhance>
    <input name="passkey">
    <button type="submit">Submit</button>
</form>