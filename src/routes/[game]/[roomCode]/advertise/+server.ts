import type { RequestHandler } from './$types';
import { createClient } from 'redis';
import { RTC_KV_PORT, RTC_KV_TOKEN, RTC_KV_URL } from '$env/static/private';

export const POST: RequestHandler = async ({ params, request }) => {
	const { game, roomCode } = params;
	const advertisement: { peerNames: string[]; hostName: string } = await request.json();
	const rtc_kv = createClient({
		password: RTC_KV_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: RTC_KV_PORT
		}
	});
	await rtc_kv.connect();
	await rtc_kv.set(`advertisements:${game}:${roomCode}`, JSON.stringify(advertisement), {
		EX: 1800
	});
    console.log("Received advertisement: ", advertisement);

	return new Response(null, { status: 204 });
};

export const GET: RequestHandler = async ({ params, request }) => {
	const { game, roomCode } = params;
	const rtc_kv = createClient({
		password: RTC_KV_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: RTC_KV_PORT
		}
	});
	await rtc_kv.connect();
	const advertisementStr: string =
		(await rtc_kv.get(`advertisements:${game}:${roomCode}`)) ??
		'{ "peerNames": [], "hostName": "" }';
	// const advertisement: { peerNames: string[], hostName: string } = await JSON.parse(advertisementStr);
    console.log("Advertisement requested: ", advertisementStr);

	return new Response(advertisementStr, { status: 200, headers: { 'Content-Type': 'application/json' } });
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
	await rtc_kv.del(`advertisements:${game}:${roomCode}`);
    console.log("Advertisement deleted");
	return new Response(null, { status: 204 });
};
