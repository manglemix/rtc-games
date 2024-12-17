import {
	NetworkPeer,
	rtcConfig,
	type DataChannelInit,
	type DataChannelInits,
	type RtcGuestConnectionMessage,
	type RtcHostConnectionMessage,
	type SignalingGuestConnectionMessage,
	type SignalingHostConnectionMessage
} from './rtc';

export class GuestPeer extends NetworkPeer {
	// private constructor(
	// 	hostName: string,
	// 	name: string,
	// 	hostRtc: RTCPeerConnection,
	// 	dataChannels: Record<string, RTCDataChannel>,
	// 	dataChannelInits: DataChannelInits
	// ) {
	// 	super(name, hostName, false, dataChannelInits);
	// 	this.addRtc(hostName, hostRtc, dataChannels);
	// }

	public static connectToRoom(
		hostName: string,
		name: string,
		dataChannelInits: DataChannelInits,
		sendToHost: (msg: SignalingGuestConnectionMessage) => void,
		abort?: AbortSignal
	): {
		fromHost: (msg: SignalingHostConnectionMessage) => void;
		onConnection: Promise<GuestPeer | null>;
	} {
		if (abort === undefined) {
			abort = AbortSignal.timeout(10000);
		}
		const peer = new GuestPeer(name, hostName, false, dataChannelInits);
		peer.onIceCandidate = (peerName, ice) => {
			if (peerName !== hostName) {
				console.error(`Expected host name ${hostName}, got ${peerName}`);
				return;
			}
			sendToHost({ ice, from: name });
		};
		peer.onSdp = (peerName, offer) => {
			if (peerName !== hostName) {
				console.error(`Expected host name ${hostName}, got ${peerName}`);
				return;
			}
			if (offer.type !== 'offer') {
				console.error(`Expected offer, got ${offer.type}`);
				return;
			}
			sendToHost({ offer, from: name });
		};

		const output = {
			fromHost: (msg: SignalingHostConnectionMessage) => {
				if (msg.ice !== undefined) {
					peer.addIceCandidate(hostName, msg.ice);
				}
				if (msg.answer !== undefined) {
					peer.addSdp(hostName, msg.answer);
				}
			},
			onConnection: new Promise<GuestPeer | null>((resolve) => {
				abort.onabort = () => resolve(null);
				if (abort.aborted) {
					resolve(null);
					return;
				}
				peer.disconnectedCallback = () => resolve(null);
				peer.connectedCallback = (peerName) => {
					peer.connectedCallback = () => {};
					if (peerName !== hostName) {
						console.error(`Expected host name ${hostName}, got ${peerName}`);
						return;
					}
					resolve(peer);
				};
			})
		};
		peer.connectingCallback = (peerName) => {
			console.info(`Connecting to ${peerName}`);
		};
		peer.createRtc(hostName);

		return output;
	}
	protected addRtc(
		peerName: string,
		rtc: RTCPeerConnection,
		dataChannels: Record<string, RTCDataChannel>
	): void {
		super.addRtc(peerName, rtc, dataChannels);
		if (peerName !== this.hostName) {
			return;
		}
		const hostRoomChannel = dataChannels['host-room']!;
		this.onIceCandidate = (recipient, ice) => {
			const toHost: RtcGuestConnectionMessage = { ice, recipient };
			hostRoomChannel.send(JSON.stringify(toHost));
		};
		this.onSdp = (recipient, sdp) => {
			const toHost: RtcGuestConnectionMessage = { sdp, recipient };
			hostRoomChannel.send(JSON.stringify(toHost));
		};
		hostRoomChannel.onmessage = async (msg) => {
			const obj: RtcHostConnectionMessage = JSON.parse(msg.data);

			if (obj.connectedPeers) {
				for (const peerName of obj.connectedPeers) {
					if (peerName === this.name || this.isConnectedTo(peerName)) {
						continue;
					}
					const tieBreaker = [this.name, peerName].sort();
					if (tieBreaker[0] !== this.name) {
						continue;
					}
					this.createRtc(peerName);
				}
				const connectedPeersSet = new Set(obj.connectedPeers);
				for (const peerName of this.getPeerNames()) {
					if (!connectedPeersSet.has(peerName)) {
						this.disconnectFrom(peerName);
					}
				}
			} else if (obj.ice) {
				this.addIceCandidate(obj.ice.from, obj.ice.candidate);
			} else if (obj.sdp) {
				this.addSdp(obj.sdp.from, obj.sdp.sdp);
			} else {
				console.error(`Unknown message from host: ${obj}`);
				return;
			}
		};
	}
}
