export type SdpOffer = { sdp: RTCSessionDescriptionInit; ices: RTCIceCandidate[] };
export type SdpAnswer = { sdp: RTCSessionDescriptionInit; ices: RTCIceCandidate[] };

class NetworkPeer {
	private rtc: RTCPeerConnection = new RTCPeerConnection();
	private rtcConnChannel: RTCDataChannel | null = null;
	private dataChannels: Map<string, RTCDataChannel> = new Map();
	private connectionPhase = false;

	private constructor() {}

	/**
	 * Create a NetworkPeer that represents the host.
	 *
	 * Hosts may send SDP offers of new peers to this peer.
	 *
	 * @param onSdpOffer
	 * @param onHostPrematureClose
	 * @returns
	 */
	static async createHost(
		onSdpOffer: (newPeerName: string, offer: SdpOffer) => void,
		dataChannels: DataChannelInit[],
		onHostPrematureClose: () => void
	) {
		const peer = new NetworkPeer();
		peer.rtcConnChannel = peer.rtc.createDataChannel('rtc-conn', { negotiated: true, id: 0 });
		peer.connectionPhase = true;
		peer.rtcConnChannel.onmessage = (event) => {
			const obj = JSON.parse(event.data);
			onSdpOffer(obj.newPeerName, obj.offer);
		};
		peer.rtcConnChannel.onclosing = () => {
			if (peer.connectionPhase) {
				onHostPrematureClose();
			}
			peer.rtcConnChannel = null;
		};
		for (const [id, dataChannelInit] of dataChannels.entries()) {
			peer.createDataChannel(dataChannelInit.label, {
				negotiated: true,
				id: id + 1,
				...dataChannelInit
			});
		}

		return {
			peer,
			offer: await peer.createSdpOffer()
		};
	}

	/**
	 * Create a NetworkPeer that represents the host.
	 *
	 * Hosts may send SDP offers of new peers to this peer.
	 *
	 * @param onSdpOffer
	 * @param onHostPrematureClose
	 * @returns
	 */
	static async createGuest(dataChannels: DataChannelInit[]) {
		const peer = new NetworkPeer();
		peer.connectionPhase = true;
		for (const [id, dataChannelInit] of dataChannels.entries()) {
			peer.createDataChannel(dataChannelInit.label, {
				negotiated: true,
				id: id + 1,
				...dataChannelInit
			});
		}

		return {
			peer,
			offer: await peer.createSdpOffer()
		};
	}

	/**
	 * Accept an offer from a peer as the host.
	 *
	 * @param offer
	 * @param onGuestPrematureClose
	 * @returns
	 */
	static async acceptOfferAsHost(
		offer: SdpOffer,
		dataChannels: DataChannelInit[],
		onGuestPrematureClose: () => void
	) {
		const peer = new NetworkPeer();
		peer.rtcConnChannel = peer.rtc.createDataChannel('rtc-conn', { negotiated: true, id: 0 });
		peer.rtcConnChannel.onclosing = () => {
			if (peer.connectionPhase) {
				onGuestPrematureClose();
			}
			peer.rtcConnChannel = null;
		};
		for (const [id, dataChannelInit] of dataChannels.entries()) {
			peer.createDataChannel(dataChannelInit.label, {
				negotiated: true,
				id: id + 1,
				...dataChannelInit
			});
		}
		await peer.rtc.setRemoteDescription(offer.sdp);
		for (const ice of offer.ices) {
			await peer.rtc.addIceCandidate(ice);
		}
		await peer.rtc.addIceCandidate();
		const answer = await peer.rtc.createAnswer();
		let ices: RTCIceCandidate[] = [];
		const finished: Promise<SdpAnswer> = new Promise((resolve) => {
			peer.rtc.onicecandidate = (event) => {
				if (event.candidate === null || event.candidate.candidate === '') {
					resolve({
						sdp: answer,
						ices
					});
				} else {
					ices.push(event.candidate);
				}
			};
		});
		await peer.rtc.setLocalDescription(answer);

		return {
			peer,
			answer: await finished
		};
	}

	/**
	 * Accept an offer from a peer as a guest.
	 *
	 * @param offer
	 * @param onGuestPrematureClose
	 * @returns
	 */
	static async acceptOfferAsGuest(offer: SdpOffer, dataChannels: DataChannelInit[]) {
		const peer = new NetworkPeer();
		for (const [id, dataChannelInit] of dataChannels.entries()) {
			peer.createDataChannel(dataChannelInit.label, {
				negotiated: true,
				id: id + 1,
				...dataChannelInit
			});
		}
		await peer.rtc.setRemoteDescription(offer.sdp);
		for (const ice of offer.ices) {
			await peer.rtc.addIceCandidate(ice);
		}
		await peer.rtc.addIceCandidate();
		const answer = await peer.rtc.createAnswer();
		let ices: RTCIceCandidate[] = [];
		const finished: Promise<SdpAnswer> = new Promise((resolve) => {
			peer.rtc.onicecandidate = (event) => {
				if (event.candidate === null || event.candidate.candidate === '') {
					resolve({
						sdp: answer,
						ices
					});
				} else {
					ices.push(event.candidate);
				}
			};
		});
		await peer.rtc.setLocalDescription(answer);

		return {
			peer,
			answer: await finished
		};
	}

	close() {
		this.rtc.close();
	}

	finishConnectionPhase() {
		this.connectionPhase = false;
	}

	private createDataChannel(label: string, dataChannelInit: RTCDataChannelInit) {
		const dataChannel = this.rtc.createDataChannel(label, dataChannelInit);
		this.dataChannels.set(label, dataChannel);
	}

	sendSdpOffer(newPeerName: string, offer: SdpOffer) {
		if (this.rtcConnChannel === null) {
			console.error('RTC connection channel is null');
		} else {
			this.rtcConnChannel.send(JSON.stringify({ newPeerName, offer }));
		}
	}

	private async createSdpOffer(enableAudio: boolean = false) {
		var mediaConstraints = {
			offerToReceiveAudio: enableAudio,
			offerToReceiveVideo: false
		};

		const offer = await this.rtc.createOffer(mediaConstraints);

		let ices: RTCIceCandidate[] = [];
		const finished: Promise<SdpOffer> = new Promise((resolve) => {
			this.rtc.onicecandidate = (event) => {
				if (event.candidate === null || event.candidate.candidate === '') {
					resolve({
						sdp: offer,
						ices
					});
				} else {
					ices.push(event.candidate);
				}
			};
		});
		await this.rtc.setLocalDescription(offer);

		return await finished;
	}

	async acceptAnswer(answer: SdpAnswer) {
		await this.rtc.setRemoteDescription(answer.sdp);
		for (const ice of answer.ices) {
			await this.rtc.addIceCandidate(ice);
		}
		await this.rtc.addIceCandidate();
	}
}

export type DataChannelInit = {
	label: string;
	maxPacketLifeTime?: number;
	maxRetransmits?: number;
	ordered?: boolean;
	protocol?: string;
};

export type ConnectToRoomInit = {
	ourName: string;
	advertisement: { peerNames: string[]; hostName: string };
	dataChannels: DataChannelInit[];
	onHostPrematureClose: () => void;
	uploadAnswer: (newPeerName: string, answer: SdpAnswer) => void;
};

export class NetworkClient {
	name: string;
	isHost: boolean;
	peers: Map<string, NetworkPeer> = new Map();
	dataChannels: DataChannelInit[];
	uploadAnswer: (newPeerName: string, answer: SdpAnswer) => void;
	advertise: (advertisement: { peerNames: string[]; hostName: string }) => void = () => {};
	public onGuestDisconnect: (peerName: string) => void = () => {};

	private constructor(
		name: string,
		isHost: boolean,
		dataChannels: DataChannelInit[],
		uploadAnswer: (newPeerName: string, answer: SdpAnswer) => void
	) {
		this.name = name;
		this.isHost = isHost;
		this.dataChannels = dataChannels;
		this.uploadAnswer = uploadAnswer;
	}

	public static async connectToRoom(init: ConnectToRoomInit) {
		const client = new NetworkClient(init.ourName, false, init.dataChannels, init.uploadAnswer);
		const offers: Record<string, SdpOffer> = {};
		for (const peerName of init.advertisement.peerNames) {
			const { peer, offer } = await NetworkPeer.createGuest(init.dataChannels);
			offers[peerName] = offer;
			client.peers.set(peerName, peer);
		}
		const { peer, offer } = await NetworkPeer.createHost(
			(newPeerName, offer) => client.acceptSdpOfferAsGuest(newPeerName, offer),
			init.dataChannels,
			init.onHostPrematureClose
		);
		offers[init.advertisement.hostName] = offer;
		client.peers.set(init.advertisement.hostName, peer);
		const pendingAnswers = new Set(init.advertisement.peerNames);
		pendingAnswers.add(init.advertisement.hostName);
		return {
			challenge: async (answers: { peerName: string; answer: SdpAnswer }[]) => {
				for (const { peerName, answer } of answers) {
					if (pendingAnswers.delete(peerName)) {
						await client.acceptSdpAnswerAsGuest(peerName, answer);
					}
				}
				if (pendingAnswers.size === 0) {
					return client;
				}
				return null;
			},
			offers
		};
	}

	finishConnectionPhase() {
		for (const peer of this.peers.values()) {
			peer.finishConnectionPhase();
		}
	}

	public static createRoom(
		ourName: string,
		dataChannels: DataChannelInit[],
		uploadAnswer: (newPeerName: string, answer: SdpAnswer) => void,
		advertise: (advertisement: { peerNames: string[]; hostName: string }) => void
	) {
		const client = new NetworkClient(ourName, true, dataChannels, uploadAnswer);
		client.advertise = advertise;
		advertise(client.advertiseAsHost());
		return client;
	}

	public close() {
		for (const peer of this.peers.values()) {
			peer.close();
		}
		this.peers.clear();
	}

	public advertiseAsHost() {
		if (!this.isHost) {
			console.error('Advertising as host even though not host');
		}
		return {
			peerNames: Array.from(this.peers.keys()),
			hostName: this.name
		};
	}

	public async acceptSdpOffers(newPeerName: string, offers: Record<string, SdpOffer>) {
		if (!this.isHost) {
			console.error('Attempted to accept SDP offers even though not host');
			return false;
		}
		// Check if all names are accounted for and there are no extra names
		const peerNames = new Set(Array.from(this.peers.keys()));
		const offerNames = new Set(Object.keys(offers));
		if (peerNames.size + 1 !== offerNames.size) {
			return false;
		}
		for (const name of peerNames) {
			if (!offerNames.has(name)) {
				return false;
			}
		}
		if (!offerNames.has(this.name)) {
			return false;
		}

		let peerToAdd: NetworkPeer | null = null;

		for (const [peerName, offer] of Object.entries(offers)) {
			if (peerName === this.name) {
				const { peer, answer } = await NetworkPeer.acceptOfferAsHost(
					offer,
					this.dataChannels,
					() => {
						this.onGuestDisconnect(peerName);
					}
				);
				peerToAdd = peer;
				this.uploadAnswer(peerName, answer);
			} else {
				this.peers.get(peerName)!.sendSdpOffer(newPeerName, offer);
			}
		}
		this.peers.set(newPeerName, peerToAdd!);
		this.advertise(this.advertiseAsHost());

		return true;
	}

	private async acceptSdpOfferAsGuest(peerName: string, offer: SdpOffer) {
		if (this.isHost) {
			console.error('Attempted to accept single SDP offer as host');
			return;
		}
		const { peer, answer } = await NetworkPeer.acceptOfferAsGuest(offer, this.dataChannels);
		this.peers.set(peerName, peer);
		this.uploadAnswer(this.name, answer);
	}

	private async acceptSdpAnswerAsGuest(peerName: string, answer: SdpAnswer) {
		if (this.isHost) {
			console.error('Attempted to accept single SDP answer as host');
			return;
		}
		await this.peers.get(peerName)!.acceptAnswer(answer);
	}
}

export function createRoomCode() {
	return Math.random().toString(36).substring(2, 8);
}

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

export async function defaultConnectToRoom(
	gameName: string,
	roomCode: string,
	ourName: string,
	dataChannels: DataChannelInit[],
	onHostPrematureClose: () => void
) {
	while (true) {
		let resp = await fetch(`/${gameName}/${roomCode}/advertise/`);
		const advertisement: { peerNames: string[]; hostName: string } = await resp.json();
		if (advertisement.hostName === '') {
			return null;
		}

		const { challenge, offers } = await NetworkClient.connectToRoom({
			ourName,
			advertisement,
			dataChannels,
			onHostPrematureClose,
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
	return setInterval(async () => {
		const resp = await fetch(`/${gameName}/${roomCode}/offers/`, {
			method: 'DELETE'
		});
		if (!resp.ok || resp.status !== 200) {
			return;
		}
		const { newPeerName, offers } = await resp.json();
		if (newPeerName === '') {
			return;
		}
		await client.acceptSdpOffers(newPeerName, offers);
	}, 2000);
}
