import { NetworkClient, type DataChannelInit, type SdpAnswer } from './rtc-client';

export function defaultUploadAnswer(gameName: string, roomCode: string) {
	return (peerName: string, answer: SdpAnswer) => {
		fetch(`/${gameName}/${roomCode}/answers/${peerName}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ peerName, answer })
		});
	};
}

export function defaultAdvertise(gameName: string, roomCode: string) {
	return (advertisement: { peerNames: string[]; hostName: string }) => {
		fetch(`/${gameName}/${roomCode}/advertise/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(advertisement)
		});
	};
}

export function defaultClearAdvertise(gameName: string, roomCode: string) {
	return fetch(`/${gameName}/${roomCode}/advertise/`, {
		method: 'DELETE'
	});
}

export async function defaultConnectToRoom(
	gameName: string,
	roomCode: string,
	ourName: string,
	dataChannels: DataChannelInit[]
) {
	while (true) {
		let resp = await fetch(`/${gameName}/${roomCode}/advertise/`);

		if (!resp.ok || resp.status !== 200) {
			return null;
		}

		const advertisement: { peerNames: string[]; hostName: string } = await resp.json();
		if (advertisement.hostName === '' || advertisement.hostName === ourName) {
			return null;
		}

		const { challenge, offers } = await NetworkClient.connectToRoom({
			ourName,
			advertisement,
			dataChannels,
			uploadAnswer: defaultUploadAnswer(gameName, roomCode)
		});
		let offerCount = Object.keys(offers).length;
		resp = await fetch(`/${gameName}/${roomCode}/offers/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ newPeerName: ourName, offers })
		});
		if (!resp.ok || resp.status !== 204) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			continue;
		}
		let client: NetworkClient | null = null;
		while (offerCount > 0) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			resp = await fetch(`/${gameName}/${roomCode}/answers/${ourName}/`, {
				method: 'DELETE'
			});
			if (!resp.ok || resp.status !== 200) {
				continue;
			}
			const answers: { peerName: string; answer: SdpAnswer }[] = await resp.json();
			offerCount -= answers.length;
			// ?? Protects against the bug where the client is ready before all offers are accepted,
			// as subsequent calls may overwrite with null. This scenario should not happen in practice.
			client = (await challenge(answers)) ?? client;
		}
		return client;
	}
}

export function defaultAcceptOffers(gameName: string, roomCode: string, client: NetworkClient) {
	let skip = false;
	let advertise = defaultAdvertise(gameName, roomCode);
	return setInterval(async () => {
		if (skip) {
			return;
		}
		const resp = await fetch(`/${gameName}/${roomCode}/offers/`, {
			method: 'GET'
		});
		if (!resp.ok || resp.status !== 200) {
			return;
		}
		const { newPeerName, offers } = await resp.json();
		if (newPeerName === '') {
			return;
		}
		const accepted = await client.acceptSdpOffersAsHost(newPeerName, offers);
		if (accepted) {
			const oldOnConnection = client.onConnection;
			skip = true;
			await new Promise<void>((resolve) => {
				client.onConnection = (peerName) => {
					oldOnConnection(peerName);
					resolve();
				};
			});
			client.onConnection = oldOnConnection;
			advertise(client.advertiseAsHost());
			await fetch(`/${gameName}/${roomCode}/offers/`, {
				method: 'DELETE'
			});
			skip = false;
		}
	}, 2000);
}
