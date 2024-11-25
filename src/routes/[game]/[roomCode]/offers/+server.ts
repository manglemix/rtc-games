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
	// Only send our offers if the key doesn't exist
	const oldValue: string =
		(await rtc_kv.set(`offers:${game}:${roomCode}`, offersStr, {
			GET: true,
			NX: true,
			EX: 600
		})) ?? '';
	if (oldValue !== '') {
		return new Response(null, { status: 429 });
	}

	return new Response(null, { status: 204 });
};

export const GET: RequestHandler = async ({ params }) => {
	const { game, roomCode } = params;
	const rtc_kv = createClient({
		password: RTC_KV_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: RTC_KV_PORT
		}
	});
	await rtc_kv.connect();
	const offersStr: string =
		(await rtc_kv.get(`offers:${game}:${roomCode}`)) ?? '{ "newPeerName": "", "offers": {} }';
	// const offers: Record<string, { sdp: RTCSessionDescriptionInit, ices: RTCIceCandidate[] }> = JSON.parse(offersStr);
	return new Response(offersStr, { status: 200, headers: { 'Content-Type': 'application/json' } });
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
	rtc_kv.del(`offers:${game}:${roomCode}`);
	return new Response(null, { status: 204 });
};
