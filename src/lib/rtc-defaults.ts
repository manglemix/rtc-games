import type {
	DataChannelInit,
	DataChannelInits,
	SignalingGuestConnectionMessage,
	SignalingHostConnectionMessage
} from './rtc';
import { GuestPeer } from './rtc-guest';
import { HostPeer } from './rtc-host';
import type {
	CloseRoomRequest,
	CreateRoomRequest,
	PopGuestMessagesRequest,
	PopGuestMessagesResponse,
	PopHostMessagesRequest,
	PopHostMessagesResponse,
	PushGuestMessageRequest,
	RespondToGuestRequest
} from './rtc-server';

export function fetchCreateRoom(game: string, hostName: string): Promise<string> {
	const body: CreateRoomRequest = { game, hostName };
	return fetch(`/api/create-room/`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	}).then((response) => {
		return response.text();
	});
}

export function fetchCloseRoom(game: string, roomCode: string): Promise<void> {
	const body: CloseRoomRequest = { game, roomCode };
	return fetch(`/api/close-room/`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	}).then(() => {});
}

export function fetchGetHostName(game: string, roomCode: string): Promise<string | null> {
	return fetch(`/api/host-name/${game}/${roomCode}`).then((response) => {
		if (response.status === 404) {
			return null;
		}
		return response.text();
	});
}

export function fetchPushGuestMessage(
	game: string,
	roomCode: string,
	message: SignalingGuestConnectionMessage
): Promise<void> {
	const body: PushGuestMessageRequest = { game, roomCode, message };
	return fetch(`/api/push-guest-message/`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	}).then(() => {});
}

export function fetchRespondToGuest(
	game: string,
	roomCode: string,
	messages: Record<string, SignalingHostConnectionMessage>
): Promise<void> {
	const body: RespondToGuestRequest = { game, roomCode, messages };
	return fetch(`/api/respond-to-guest/`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	}).then(() => {});
}

export function fetchPopGuestMessages(
	game: string,
	roomCode: string,
	signal?: AbortSignal
): Promise<PopGuestMessagesResponse> {
	const body: PopGuestMessagesRequest = { game, roomCode };
	return fetch(`/api/pop-guest-messages/`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body),
		signal
	}).then(async (response) => {
		return (await response.json()) ?? [];
	});
}

export function fetchPopHostMessages(
	game: string,
	roomCode: string,
	guestName: string,
	signal?: AbortSignal
): Promise<PopHostMessagesResponse> {
	const body: PopHostMessagesRequest = { game, roomCode, name: guestName };
	return fetch(`/api/pop-host-messages/`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body),
		signal
	}).then(async (response) => {
		return (await response.json()) ?? [];
	});
}

export async function createRoom(
	game: string,
	hostName: string,
	dataChannelInits: DataChannelInits
): Promise<{
	peer: HostPeer;
	roomCode: string;
	closeRoom: () => void;
}> {
	const roomCode = await fetchCreateRoom(game, hostName);
	const peer = new HostPeer(
		hostName,
		(msgs) => {
			fetchRespondToGuest(game, roomCode, msgs);
		},
		dataChannelInits
	);
	const aborter = new AbortController();
	const signal = aborter.signal;

	const task = async () => {
		while (!aborter.signal.aborted) {
			try {
				const messages = await fetchPopGuestMessages(game, roomCode, signal);
				await peer.acceptGuestConnectionMessages(messages);
			} catch (_) {
				break;
			}
		}
	};
	task();

	return {
		peer,
		roomCode,
		closeRoom: () => {
			aborter.abort();
			fetchCloseRoom(game, roomCode);
		}
	};
}

export async function joinRoom(
	game: string,
	name: string,
	roomCode: string,
	dataChannelInits: DataChannelInits
): Promise<{ peer: GuestPeer; hostName: string } | null> {
	const hostName = await fetchGetHostName(game, roomCode);
	if (hostName === null) {
		return null;
	}
	const aborter = new AbortController();
	const signal = aborter.signal;
	const { fromHost, onConnection } = GuestPeer.connectToRoom(
		hostName,
		name,
		dataChannelInits,
		(msg) => {
			if (signal.aborted) {
				return;
			}
			fetchPushGuestMessage(game, roomCode, msg);
		}
	);

	const task = async () => {
		while (!aborter.signal.aborted) {
			try {
				const messages = await fetchPopHostMessages(game, roomCode, name, signal);
				for (const message of messages) {
					fromHost(message);
				}
			} catch (_) {
				break;
			}
		}
	};
	task();

	const peer = await onConnection;
	aborter.abort();

	if (peer === null) {
		return null;
	}

	return { peer, hostName };
}
