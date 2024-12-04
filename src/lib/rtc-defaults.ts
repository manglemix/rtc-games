import type { SignalingGuestConnectionMessage, SignalingHostConnectionMessage } from "./rtc";
import type { CreateRoomRequest, PopGuestMessagesRequest, PopGuestMessagesResponse, PopHostMessagesRequest, PopHostMessagesResponse, PushGuestMessageRequest, RespondToGuestRequest } from "./rtc-server";

export function createRoom(game: string, hostName: string): Promise<boolean> {
	const body: CreateRoomRequest = { game, hostName };
	return fetch(`/api/create-room/`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	}).then((response) => {
		return response.ok;
	});
}

export function getHostName(game: string, roomCode: string): Promise<string | null> {
	return fetch(`/api/host-name/${game}/${roomCode}`).then((response) => {
		if (response.status === 404) {
			return null;
		}
		return response.text();
	});
}

export function pushGuestMessage(game: string, roomCode: string, message: SignalingGuestConnectionMessage): Promise<boolean> {
	const body: PushGuestMessageRequest = { game, roomCode, message };
	return fetch(`/api/push-guest-message/`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	}).then((response) => {
		return response.ok;
	});
}

export function respondToGuest(game: string, roomCode: string, messages: Record<string, SignalingHostConnectionMessage>): Promise<boolean> {
	const body: RespondToGuestRequest = { game, roomCode, messages };
	return fetch(`/api/respond-to-guest/`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	}).then((response) => {
		return response.ok;
	});
}

export function popGuestMessages(game: string, roomCode: string): Promise<PopGuestMessagesResponse> {
	const body: PopGuestMessagesRequest = { game, roomCode };
	return fetch(`/api/pop-guest-messages/`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	}).then((response) => {
		return response.json();
	});
}

export function popHostMessages(game: string, roomCode: string, guestName: string): Promise<PopHostMessagesResponse> {
	const body: PopHostMessagesRequest = { game, roomCode, name: guestName };
	return fetch(`/api/pop-host-messages/`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	}).then((response) => {
		return response.json();
	});
}