import { createClient } from 'redis';
import { RTC_KV_PORT, RTC_KV_ROOT_TOKEN, RTC_KV_URL } from '$env/static/private';
import { Buffer } from 'buffer';
import type { RequestHandler } from '@sveltejs/kit';
import type { SignalingGuestConnectionMessage, SignalingHostConnectionMessage } from './rtc';

export interface CreateRoomRequest {
    readonly game: string;
    readonly hostName: string;
}

/**
 * The host PUTs to this endpoint to advertise their name and prove the room exists.
 */
export const createRoom: RequestHandler = async ({ request }) => {
	const { game, hostName }: CreateRoomRequest = await request.json();

	if (game !== 'hantu') {
		return new Response(null, { status: 400 });
	}

	if (hostName.length < 4 || hostName.length > 16) {
		return new Response(null, { status: 400 });
	}

	// Assert hostName is only alphanumeric
	if (!/^[a-zA-Z0-9]+$/.test(hostName)) {
		return new Response(null, { status: 400 });
	}

	const rtcKv = createClient({
		password: RTC_KV_ROOT_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: parseInt(RTC_KV_PORT)
		}
	});
	await rtcKv.connect();
	const roomCodeHex: string = await rtcKv.aclGenPass(36);
	let roomCode = Buffer.from(roomCodeHex, 'hex').toString('base64');
	roomCode = roomCode.replaceAll('+', '0').replaceAll('/', '1').replaceAll('=', '2');
    
    await rtcKv.set(`${game}:${roomCode}:hostName`, hostName, { EX: 1800 });

	return new Response(null, { status: 204 });
};

/**
 * Guests GET this endpoint to check if the room exists and get the host's name.
 */
export const getHostName: RequestHandler = async ({ params }) => {
    const { game, roomCode } = params;
    if (game === undefined || roomCode === undefined) {
        return new Response(null, { status: 404 });
    }
	const rtcKv = createClient({
		password: RTC_KV_ROOT_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: parseInt(RTC_KV_PORT)
		}
	});
	await rtcKv.connect();
    
    const hostName = await rtcKv.get(`${game}:${roomCode}:hostName`);

    if (hostName === null) {
        return new Response(null, { status: 404 });
    }

	return new Response(hostName, { status: 200 });
};

export interface PushGuestMessageRequest {
    readonly game: string;
    readonly roomCode: string;
    readonly message: SignalingGuestConnectionMessage;
}

/**
 * Guests PUT to this endpoint to send messages to the host to join the room.
 */
export const pushGuestMessage: RequestHandler = async ({ request }) => {
	const { game, roomCode, message }: PushGuestMessageRequest = await request.json();

	if (game !== 'hantu') {
		return new Response(null, { status: 400 });
	}

	const rtcKv = createClient({
		password: RTC_KV_ROOT_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: parseInt(RTC_KV_PORT)
		}
	});
	await rtcKv.connect();
    await rtcKv.lPush(`${game}:${roomCode}:guestMessages`, JSON.stringify(message));
    await rtcKv.expire(`${game}:${roomCode}:guestMessages`, 1800);

	return new Response(null, { status: 204 });
};

export interface RespondToGuestRequest {
    readonly game: string;
    readonly roomCode: string;
    readonly messages: Record<string, SignalingHostConnectionMessage>;
}

/**
 * The host PUTs to this endpoint to respond to messages from guests individually.
 */
export const respondToGuest: RequestHandler = async ({ request }) => {
	const { game, roomCode, messages }: RespondToGuestRequest = await request.json();

	if (game !== 'hantu') {
		return new Response(null, { status: 400 });
	}

	const rtcKv = createClient({
		password: RTC_KV_ROOT_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: parseInt(RTC_KV_PORT)
		}
	});
	await rtcKv.connect();

    for (const [peerName, message] of Object.entries(messages)) {
        await rtcKv.lPush(`${game}:${roomCode}:${peerName}:hostMessages`, JSON.stringify(message));
        await rtcKv.expire(`${game}:${roomCode}:${peerName}:hostMessages`, 1800);
    }

	return new Response(null, { status: 204 });
};

export interface PopGuestMessagesRequest {
    readonly game: string;
    readonly roomCode: string;
}

export type PopGuestMessagesResponse = SignalingGuestConnectionMessage[];

/**
 * The host DELETEs from this endpoint to get messages from guests.
 */
export const popGuestMessages: RequestHandler = async ({ request }) => {
	const { game, roomCode }: PopGuestMessagesRequest = await request.json();

	if (game !== 'hantu') {
		return new Response(null, { status: 400 });
	}

	const rtcKv = createClient({
		password: RTC_KV_ROOT_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: parseInt(RTC_KV_PORT)
		}
	});
	await rtcKv.connect();
    const messages: PopGuestMessagesResponse = [];
    const { element: message } = await rtcKv.brPop(`${game}:${roomCode}:guestMessages`, 8) ?? {};
    if (message === undefined) {
        return new Response(JSON.stringify(messages), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    messages.push(JSON.parse(message));
    while (true) {
        const message = await rtcKv.rPop(`${game}:${roomCode}:guestMessages`);
        if (message === null) {
            break;
        }
        messages.push(JSON.parse(message));
    }
	return new Response(JSON.stringify(messages), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export interface PopHostMessagesRequest {
    readonly game: string;
    readonly roomCode: string;
    readonly name: string;
}

export type PopHostMessagesResponse = SignalingHostConnectionMessage[];

/**
 * Guests DELETE from this endpoint to get messages from the host.
 */
export const popHostMessages: RequestHandler = async ({ request }) => {
	const { game, roomCode, name }: PopHostMessagesRequest = await request.json();

	if (game !== 'hantu') {
		return new Response(null, { status: 400 });
	}

	const rtcKv = createClient({
		password: RTC_KV_ROOT_TOKEN,
		socket: {
			host: RTC_KV_URL,
			port: parseInt(RTC_KV_PORT)
		}
	});
	await rtcKv.connect();
    const messages: PopHostMessagesResponse = [];
    const { element: message } = await rtcKv.brPop(`${game}:${roomCode}:${name}:hostMessages`, 8) ?? {};
    if (message === undefined) {
        return new Response(JSON.stringify(messages), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    messages.push(JSON.parse(message));
    while (true) {
        const message = await rtcKv.rPop(`${game}:${roomCode}:${name}:hostMessages`);
        if (message === null) {
            break;
        }
        messages.push(JSON.parse(message));
    }
	return new Response(JSON.stringify(messages), { status: 200, headers: { 'Content-Type': 'application/json' } });
};