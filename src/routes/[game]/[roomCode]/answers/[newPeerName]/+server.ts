import type { RequestHandler } from './$types';
import { createClient } from 'redis';
import { RTC_KV_PORT, RTC_KV_TOKEN, RTC_KV_URL } from '$env/static/private';

export type SdpAnswer = { sdp: RTCSessionDescriptionInit; ices: RTCIceCandidate[] };

export const POST: RequestHandler = async ({ params, request }) => {
	const { game, roomCode } = params;
	const answer: { peerName: string; answer: SdpAnswer } = await request.json();
	const rtc_kv = createClient({
		password: RTC_KV_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: RTC_KV_PORT
		}
	});
	await rtc_kv.connect();
	await rtc_kv.lPush(`answers:${game}:${roomCode}`, JSON.stringify(answer));
	await rtc_kv.expire(`answers:${game}:${roomCode}`, 1800);

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

	const answers: { peerName: string; answer: SdpAnswer }[] = [];
	while (true) {
		const answerStr: string | null = await rtc_kv.rPop(`answers:${game}:${roomCode}`);
		if (answerStr === null) {
			break;
		}
		answers.push(JSON.parse(answerStr));
	}

	return new Response(JSON.stringify(answers), { status: 200 });
};
