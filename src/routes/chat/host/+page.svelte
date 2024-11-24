<script lang=ts>
	import { browser } from "$app/environment";
	import { enhance } from "$app/forms";
	import { acceptSdpOffer } from "$lib/rtc-client";
	import type { PageData } from "../$types";
	import type { ActionData } from "./$types";

	let { data, form }: { data: PageData, form: ActionData } = $props();
    let accepting = $state(true);

    if (browser) {
        const pc = new RTCPeerConnection();
        async function onResponse(res: Response) {
            if (!accepting) {
                return;
            }

            const resp: { offers: RTCSessionDescriptionInit[] } = await res.json();
            resp.offers.forEach(offer => {
                
            });
        }
        // Fetch every 2 seconds
        const interval = setInterval(() => {
            fetch("", {
                method: "POST"
            }).then(onResponse);
        }, 2000);

    //     const pc = new RTCPeerConnection();
    //     $effect(() => {
    //         if (form) {
    //             if (form.sdpOffer) {
    //                 acceptSdpOffer(pc, form.sdpOffer).then((sdpAnswer) => {
    //                     fetch("", {
    //                         method: "POST",
    //                         headers: { "Content-Type": "application/json" },
    //                         body: JSON.stringify({ sdpAnswer })
    //                     });
    //                 });
    //             } else {
    //                 alert("Invalid passkey");
    //             }
    //         }
    //     });
    }
</script>

<p>Passkey: {data.passkey}</p>
<!-- <form method="POST" use:enhance>
    <input name="passkey">
    <button type="submit">Invite</button>
</form> -->