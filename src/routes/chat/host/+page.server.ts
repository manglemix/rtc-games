import { getSdpOffer } from "$lib/rtc-server";
import type { PageServerLoad } from "../$types.js";

export const load: PageServerLoad = async ({ }) => {
	const passkey = Math.random().toString(36).substring(2, 8);
	return { passkey };
};

export const actions = {
	default: async ({ request }) => {
        const formData = await request.formData();
        const passkey = formData.get("passkey") as string;
		const sdpOffer = await getSdpOffer("chat", passkey);
		return { sdpOffer };
	}
};