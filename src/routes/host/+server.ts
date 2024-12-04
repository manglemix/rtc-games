import type { RequestHandler } from './$types';
import { createClient } from 'redis';
import { RTC_KV_ROOT_TOKEN } from '$env/static/private';
import { RTC_KV_PORT, RTC_KV_URL } from '$lib/rtc-common';
import { Buffer } from 'buffer';

export const POST: RequestHandler = async ({ request }) => {
	const requestObj = await request.json();

	const game: string | undefined = requestObj.game;
	const peerName: string | undefined = requestObj.peerName;

	if (peerName === undefined || game === undefined) {
		return new Response(null, { status: 400 });
	}

	if (game !== 'hantu') {
		return new Response(null, { status: 400 });
	}

	if (peerName.length < 4 || peerName.length > 16) {
		return new Response(null, { status: 400 });
	}

	// Assert peerName is only alphanumeric
	if (!/^[a-zA-Z0-9]+$/.test(peerName)) {
		return new Response(null, { status: 400 });
	}

	const rtc_kv = createClient({
		password: RTC_KV_ROOT_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: RTC_KV_PORT
		}
	});
	await rtc_kv.connect();
	const roomCodeHex: string = await rtc_kv.aclGenPass(36);
	let roomCode = Buffer.from(roomCodeHex, 'hex').toString('base64');
	roomCode = roomCode.replaceAll('+', '0').replaceAll('/', '1').replaceAll('=', '2');

	const password: string = await rtc_kv.aclGenPass();
	await rtc_kv.aclSetUser(`${game}:${roomCode}:${peerName}`, [
		'reset',
		`>${password}`,
		`~${game}:${roomCode}:${peerName}:*`,
		'+lpop',
		'+get'
	]);
	// Only send our offers if the key doesn't exist
	// const oldValue: string =
	// 	(await rtc_kv.set(`offers:${game}:${roomCode}`, offersStr, {
	// 		GET: true,
	// 		NX: true,
	// 		EX: 600
	// 	})) ?? '';
	// if (oldValue !== '') {
	// 	return new Response(null, { status: 429 });
	// }

	return new Response(null, { status: 204 });
};

// export const GET: RequestHandler = async ({ params }) => {
// 	const { game, roomCode } = params;
// 	const rtc_kv = createClient({
// 		password: RTC_KV_TOKEN,
// 		socket: {
// 			host: RTC_KV_URL,
// 			port: RTC_KV_PORT
// 		}
// 	});
// 	await rtc_kv.connect();
// 	const offersStr: string =
// 		(await rtc_kv.get(`offers:${game}:${roomCode}`)) ?? '{ "newPeerName": "", "offers": {} }';
// 	// const offers: Record<string, { sdp: RTCSessionDescriptionInit, ices: RTCIceCandidate[] }> = JSON.parse(offersStr);
// 	return new Response(offersStr, { status: 200, headers: { 'Content-Type': 'application/json' } });
// };

// export const DELETE: RequestHandler = async ({ params }) => {
// 	const { game, roomCode } = params;
// 	const rtc_kv = createClient({
// 		password: RTC_KV_TOKEN,
// 		socket: {
// 			host: RTC_KV_URL,
// 			port: RTC_KV_PORT
// 		}
// 	});
// 	await rtc_kv.connect();
// 	rtc_kv.del(`offers:${game}:${roomCode}`);
// 	return new Response(null, { status: 204 });
// };
