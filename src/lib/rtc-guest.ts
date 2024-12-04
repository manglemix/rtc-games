import {
	NetworkPeer,
	rtcConfig,
	type DataChannelInit,
	type RtcGuestConnectionMessage,
	type RtcHostConnectionMessage,
	type SignalingGuestConnectionMessage,
	type SignalingHostConnectionMessage
} from './rtc';

interface ConnectingPeer {
	provideIce: (ice: RTCIceCandidate | null) => void;
	provideAnswer?: (answer: RTCSessionDescriptionInit) => void;
}

export class GuestPeer extends NetworkPeer {
	private constructor(
		hostName: string,
		name: string,
		hostRtc: RTCPeerConnection,
		dataChannels: Record<string, RTCDataChannel>
	) {
		super(name, hostName, false);
		this.addRtc(hostName, hostRtc, dataChannels);
	}

	public static connectToRoom(
		hostName: string,
		name: string,
		dataChannelInits: DataChannelInit[],
		sendToHost: (msg: SignalingGuestConnectionMessage) => void,
		abort?: AbortSignal
	): {
		fromHost: (msg: SignalingHostConnectionMessage) => void;
		onConnection: Promise<GuestPeer | null>;
	} {
		if (abort === undefined) {
			abort = AbortSignal.timeout(10000);
		}
		const rtc = new RTCPeerConnection(rtcConfig);

		const fromHost = (obj: SignalingHostConnectionMessage) => {
			if (obj.ice !== undefined) {
				rtc.addIceCandidate(obj.ice ?? undefined);
			}
			if (obj.answer) {
				rtc.setRemoteDescription(obj.answer);
			}
		};

		return {
			fromHost,
			onConnection: new Promise<GuestPeer | null>(async (resolve) => {
				abort.onabort = () => resolve(null);
				if (abort.aborted) {
					resolve(null);
					return;
				}
				const hostRoomChannel = rtc.createDataChannel('host-room', {
					negotiated: true,
					id: 0,
					ordered: true
				});
				let resolvedPeer: GuestPeer | null = null;
				const connectingPeers: Record<string, ConnectingPeer> = {};

				hostRoomChannel.onmessage = async (msg) => {
					const obj: RtcHostConnectionMessage = JSON.parse(msg.data);

					if (obj.connectedPeers) {
						console.log(`Connected peers: ${obj.connectedPeers}`);
						for (const peerName of obj.connectedPeers) {
							if (peerName === name || resolvedPeer!.isConnectedTo(peerName)) {
								continue;
							}
							const tieBreaker = [name, peerName].sort();
							if (tieBreaker[0] !== name) {
								continue;
							}
							const rtc = new RTCPeerConnection(rtcConfig);
							const dataChannels = GuestPeer.createDataChannels(rtc, dataChannelInits);
							resolvedPeer!.connectingCallback(peerName);

							rtc.onicecandidate = ({ candidate }) => {
								const toHost: RtcGuestConnectionMessage = { ice: candidate, recipient: peerName };
								hostRoomChannel.send(JSON.stringify(toHost));
							};

							rtc.onconnectionstatechange = () => {
								switch (rtc.connectionState) {
									case 'new':
									case 'connecting':
										break;
									case 'connected':
										delete connectingPeers[peerName];
										resolvedPeer!.addRtc(peerName, rtc, dataChannels);
										break;
									case 'disconnected':
									case 'closed':
									case 'failed':
										delete connectingPeers[peerName];
										break;
									default:
										delete connectingPeers[peerName];
										console.error(
											`Unknown connection state: ${rtc.connectionState} from ${peerName}`
										);
										break;
								}
							};

							const offer = await rtc.createOffer();
							rtc.setLocalDescription(offer);
							connectingPeers[peerName] = {
								provideIce: (ice) => {
									rtc.addIceCandidate(ice ?? undefined);
								},
								provideAnswer: (answer) => {
									rtc.setRemoteDescription(answer);
								}
							};

							const toHost: RtcGuestConnectionMessage = { offer, recipient: peerName };
							hostRoomChannel.send(JSON.stringify(toHost));
						}
						const connectedPeersSet = new Set(obj.connectedPeers);
						for (const peerName of resolvedPeer!.getPeerNames()) {
							if (!connectedPeersSet.has(peerName)) {
								resolvedPeer!.disconnectFrom(peerName);
							}
						}
					} else if (obj.ice) {
						const peer = connectingPeers[obj.ice.from];
						if (peer === undefined) {
							console.error(`No connecting peer for ${obj.ice.from}`);
							return;
						}
						peer.provideIce(obj.ice.candidate);
					} else if (obj.offer) {
						if (connectingPeers[obj.offer.from] !== undefined) {
							console.error(`${obj.offer.from} is already connecting`);
							return;
						}
						resolvedPeer!.connectingCallback(obj.offer.from);
						const rtc = new RTCPeerConnection(rtcConfig);
						const recipient = obj.offer.from;
						const dataChannels = GuestPeer.createDataChannels(rtc, dataChannelInits);

						rtc.onicecandidate = ({ candidate }) => {
							const toHost: RtcGuestConnectionMessage = { ice: candidate, recipient };
							hostRoomChannel.send(JSON.stringify(toHost));
						};

						rtc.onconnectionstatechange = () => {
							switch (rtc.connectionState) {
								case 'new':
								case 'connecting':
									break;
								case 'connected':
									delete connectingPeers[recipient];
									resolvedPeer!.addRtc(recipient, rtc, dataChannels);
									break;
								case 'disconnected':
								case 'closed':
								case 'failed':
									delete connectingPeers[recipient];
									break;
								default:
									delete connectingPeers[recipient];
									console.error(
										`Unknown connection state: ${rtc.connectionState} from ${recipient}`
									);
									break;
							}
						};

						await rtc.setRemoteDescription(obj.offer.sdp);
						const answer = await rtc.createAnswer();
						rtc.setLocalDescription(answer);
						connectingPeers[recipient] = {
							provideIce: (ice) => {
								rtc.addIceCandidate(ice ?? undefined);
							}
						};
						const toHost: RtcGuestConnectionMessage = { answer, recipient };
						hostRoomChannel.send(JSON.stringify(toHost));
					} else if (obj.answer) {
						const peer = connectingPeers[obj.answer.from];
						if (peer === undefined) {
							console.error(`No connecting peer for ${obj.answer.from}`);
							return;
						}
						if (peer.provideAnswer === undefined) {
							console.error(`Answer already provided from ${obj.answer.from}`);
							return;
						}
						peer.provideAnswer(obj.answer.sdp);
						peer.provideAnswer = undefined;
					} else {
						console.error(`Unknown message from host: ${obj}`);
						return;
					}
				};

				const dataChannels = GuestPeer.createDataChannels(rtc, dataChannelInits, true);
				const sdpOffer = await rtc.createOffer();

				rtc.onicecandidate = ({ candidate }) => {
					sendToHost({ ice: candidate, name });
				};

				sendToHost({ offer: sdpOffer, name });

				rtc.onconnectionstatechange = () => {
					switch (rtc.connectionState) {
						case 'new':
						case 'connecting':
							break;
						case 'connected':
							resolvedPeer = new GuestPeer(hostName, name, rtc, dataChannels);
							hostRoomChannel.onopen = () => resolve(resolvedPeer);
							break;
						case 'disconnected':
						case 'closed':
						case 'failed':
							resolve(null);
							break;
						default:
							resolve(null);
							console.error(`Unknown connection state: ${rtc.connectionState} from ${name}`);
							break;
					}
				};

				rtc.setLocalDescription(sdpOffer);
			})
		};
	}
}
