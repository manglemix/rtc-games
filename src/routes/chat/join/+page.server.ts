import { writeSdpOffer } from "$lib/rtc-server";

export const actions = {
	default: async ({ request }) => {
        const formData = await request.formData();
        const passkey = await writeSdpOffer("chat", JSON.parse(formData.get("offerAndIce") as string));
		return { passkey };
	}
};