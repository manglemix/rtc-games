import type { RequestHandler } from './$types';
import { createClient } from 'redis';
import { RTC_KV_PORT, RTC_KV_TOKEN, RTC_KV_URL } from '$env/static/private';

export const POST: RequestHandler = async ({ params, request }) => {
	const { game, roomCode } = params;
	// const offers: { newPeerName: string, offers: Record<string, { sdp: RTCSessionDescriptionInit; ices: RTCIceCandidate[] }>} =
	// 	await request.json();
    const offersStr = await request.text();
	const rtc_kv = createClient({
		password: RTC_KV_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: RTC_KV_PORT
		}
	});
	await rtc_kv.connect();
    console.log("Received offers: ", offersStr);
	while (true) {
		// Only send our offers if the key doesn't exist
		const oldValue: string =
			(await rtc_kv.set(`offers:${game}:${roomCode}`, offersStr, {
				GET: true,
				NX: true,
				EX: 10
			})) ?? '';
		if (oldValue === '') {
			break;
		}
		// sleep for 2 seconds
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
    console.log("Wrote offers: ", offersStr);

	return new Response(null, { status: 204 });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { game, roomCode } = params;
	const rtc_kv = createClient({
		password: RTC_KV_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: RTC_KV_PORT
		}
	});
	await rtc_kv.connect();
	const offersStr: string = (await rtc_kv.getDel(`offers:${game}:${roomCode}`)) ?? '{ "newPeerName": "", "offers": {} }';
    console.log("Read offers: ", offersStr);
	// const offers: Record<string, { sdp: RTCSessionDescriptionInit, ices: RTCIceCandidate[] }> = JSON.parse(offersStr);
	return new Response(offersStr, { status: 200, headers: { 'Content-Type': 'application/json' } });
};
