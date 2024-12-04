export interface DataChannelInit {
	label: string;
	hostOnly?: boolean;
	maxPacketLifeTime?: number;
	maxRetransmits?: number;
	ordered?: boolean;
	protocol?: string;
}

export let rtcConfig = {
	iceServers: [
		{
			urls: 'stun:stun.relay.metered.ca:80'
		},
		{
			urls: 'turn:global.relay.metered.ca:80',
			username: '03f299ccbd35840a927a7012',
			credential: 'cfJhlf3VwrROlRif'
		},
		{
			urls: 'turn:global.relay.metered.ca:80?transport=tcp',
			username: '03f299ccbd35840a927a7012',
			credential: 'cfJhlf3VwrROlRif'
		},
		{
			urls: 'turn:global.relay.metered.ca:443',
			username: '03f299ccbd35840a927a7012',
			credential: 'cfJhlf3VwrROlRif'
		},
		{
			urls: 'turns:global.relay.metered.ca:443?transport=tcp',
			username: '03f299ccbd35840a927a7012',
			credential: 'cfJhlf3VwrROlRif'
		}
	]
};

export abstract class NetworkPeer {
	/**
	 * A map of event handlers for each peer name.
	 */
	public onMessage: Record<string, Record<string, ((msg: MessageEvent) => void)[]>> = {};

	/**
	 * A map of named data channels for each peer name.
	 */
	private dataChannels: Record<string, Record<string, RTCDataChannel>> = {};

	private rtcConnections: Record<string, RTCPeerConnection> = {};

	public connectingCallback: (peerName: string) => void = () => {};
	public connectedCallback: (peerName: string) => void = () => {};
	public disconnectedCallback: (peerName: string) => void = () => {};

	// protected constructor(protected rtc: RTCPeerConnection) { }

	public getOnMessagesForPeer(peerName: string): Record<string, ((msg: MessageEvent) => void)[]> {
		if (this.onMessage[peerName] === undefined) {
			this.onMessage[peerName] = {};
		}
		return this.onMessage[peerName];
	}

	public setOnMessagesForPeer(
		peerName: string,
		handlers: Record<string, ((msg: MessageEvent) => void)[]>
	): void {
		this.onMessage[peerName] = handlers;
	}

	public addOnMessageForPeer(
		peerName: string,
		channelName: string,
		handler: (msg: MessageEvent) => void
	): void {
		this.getOnMessagesForPeer(peerName)[channelName]!.push(handler);
	}

	public clearOnMessagesForPeer(peerName: string): void {
		this.setOnMessagesForPeer(peerName, {});
	}

	public broadcast(msg: string, channelName: string): void {
		for (const peerName in this.dataChannels) {
			this.sendTo(peerName, msg, channelName);
		}
	}

	public sendTo(peerName: string, msg: string, channelName: string): boolean {
		if (this.dataChannels[peerName] === undefined) {
			console.error(`No data channels for peer ${peerName}`);
			return false;
		}
		const channel = this.dataChannels[peerName][channelName];
		if (channel === undefined) {
			console.error(`No data channel ${channelName} to peer ${peerName}`);
			return false;
		}
		if (channel.readyState !== 'open') {
			console.error(`Data channel ${channelName} to peer ${peerName} is not open`);
			return false;
		}
		channel.send(msg);
		return true;
	}

	protected addRtc(
		peerName: string,
		rtc: RTCPeerConnection,
		dataChannels: Record<string, RTCDataChannel>
	): void {
		if (this.rtcConnections[peerName] !== undefined) {
			console.error(`RTC connection to ${peerName} already exists`);
			return;
		}
		rtc.onconnectionstatechange = () => {
			switch (rtc.connectionState) {
				case 'failed':
					console.error('RTC connection failed, treating as disconnect...');
				case 'closed':
				case 'disconnected':
                    this.onPeerDisconnect(peerName);
					break;
				case 'new':
				case 'connecting':
				case 'connected':
					console.error(`Unexpected connection state: ${rtc.connectionState}`);
					break;
				default:
					console.error(`Unknown connection state: ${rtc.connectionState}`);
					break;
			}
		};
		for (const [channelName, channel] of Object.entries(dataChannels)) {
			channel.onmessage = (msg) => {
				this.getOnMessagesForPeer(peerName)[channelName]!.forEach((handler) => handler(msg));
			};
		}
		this.dataChannels[peerName] = dataChannels;
		this.rtcConnections[peerName] = rtc;
		this.connectedCallback(peerName);
	}

	protected static createDataChannels(
		rtc: RTCPeerConnection,
		dataChannelInits: DataChannelInit[]
	): Record<string, RTCDataChannel> {
		const dataChannels: Record<string, RTCDataChannel> = {};
		for (const [id, dataChannelInit] of dataChannelInits.entries()) {
			dataChannels[dataChannelInit.label] = rtc.createDataChannel(dataChannelInit.label, {
				negotiated: true,
				id: id + 1,
				...dataChannelInit
			});
		}
		return dataChannels;
	}

    protected onPeerDisconnect(peerName: string): void {
        // Retain onMessage handlers for reconnection
        console.log(`RTC connection to ${peerName} disconnected`);
        delete this.dataChannels[peerName];
        delete this.rtcConnections[peerName];
        this.disconnectedCallback(peerName);
    }
}

export interface SignalingHostConnectionMessage {
	// It is worthwhile to send `null` instead of omitting the field, because `null` represents ICE gathering completion
	readonly ice?: RTCIceCandidate | null;
	readonly answer?: RTCSessionDescriptionInit;
}

export interface SignalingGuestConnectionMessage {
	// It is worthwhile to send `null` instead of omitting the field, because `null` represents ICE gathering completion
	readonly ice?: RTCIceCandidate | null;
	readonly offer?: RTCSessionDescriptionInit;
    readonly name: string;
}

interface RtcHostConnectionMessage {
    readonly connectedPeers?: string[];
    readonly ice?: {
        candidate: RTCIceCandidate;
        from: string;
    };
    readonly offer?: {
        sdp: RTCSessionDescriptionInit;
        from: string;
    };
    readonly answer?: {
        sdp: RTCSessionDescriptionInit;
        from: string;
    };
}

interface RtcGuestConnectionMessage {
    readonly ice?: RTCIceCandidate;
    readonly offer?: RTCSessionDescriptionInit;
    readonly answer?: RTCSessionDescriptionInit;
    readonly recipient: string;
}

export class GuestPeer extends NetworkPeer {
	private constructor(
		public readonly hostName: string,
		public readonly name: string,
		hostRtc: RTCPeerConnection,
		dataChannels: Record<string, RTCDataChannel>,
		private hostRoomChannel: RTCDataChannel,
		private dataChannelInits: DataChannelInit[]
	) {
		super();
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
                if (obj.ice === null) {
                    rtc.addIceCandidate();
                } else {
                    rtc.addIceCandidate(obj.ice);
                }
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

                hostRoomChannel.onmessage = (msg) => {
                    const obj: RtcHostConnectionMessage = JSON.parse(msg.data);
                };

				const dataChannels = GuestPeer.createDataChannels(rtc, dataChannelInits);
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
							resolve(
								new GuestPeer(hostName, name, rtc, dataChannels, hostRoomChannel, dataChannelInits)
							);
							break;
						case 'disconnected':
						case 'closed':
						case 'failed':
							resolve(null);
							break;
						default:
							resolve(null);
							console.error(`Unknown connection state: ${rtc.connectionState}`);
							break;
					}
				};

				rtc.setLocalDescription(sdpOffer);
			})
		};
	}
}

interface ConnectingGuest {
	provideIce: (ice: RTCIceCandidate | null) => void;
}

export class HostPeer extends NetworkPeer {
	private hostRoomDataChannels: Record<string, RTCDataChannel> = {};
	private connectingGuests: Record<string, ConnectingGuest> = {};

	public constructor(
		public sendToConnectingGuests: (msgs: Record<string, SignalingHostConnectionMessage>) => void,
		private dataChannelInits: DataChannelInit[]
	) {
		super();
	}

	public async acceptGuestConnectionMessages(
		msgs: SignalingGuestConnectionMessage[]
	): Promise<void> {
		const tasks: Record<string, Promise<SignalingHostConnectionMessage>> = {};
		for (const msg of msgs) {
            const guestName = msg.name;
			const connectingGuest = this.connectingGuests[guestName];
			if (msg.ice) {
                if (connectingGuest === undefined) {
                    console.error(`Received ICE from ${guestName} before offer`);
                    continue;
                }
                connectingGuest.provideIce(msg.ice);

			} else if (msg.offer) {
				if (connectingGuest !== undefined) {
					console.error(`${guestName} is already connecting`);
					continue;
				}
				const rtc = new RTCPeerConnection(rtcConfig);
				const hostRoomChannel = rtc.createDataChannel('host-room', {
					negotiated: true,
					id: 0,
					ordered: true
				});

                hostRoomChannel.onmessage = (msg) => {
                    const obj: RtcGuestConnectionMessage = JSON.parse(msg.data);
                    const dataChannel = this.hostRoomDataChannels[obj.recipient];
                    if (dataChannel === undefined) {
                        console.error(`No data channel to ${obj.recipient} (requested by ${guestName})`);
                        return;
                    }
                    let hostMsg: RtcHostConnectionMessage;
                    if (obj.ice) {
                        hostMsg = { ice: { candidate: obj.ice, from: guestName } };
                    } else if (obj.offer) {
                        hostMsg = { offer: { sdp: obj.offer, from: guestName } };
                    } else if (obj.answer) {
                        hostMsg = { answer: { sdp: obj.answer, from: guestName } };
                    } else {
                        console.error(`Unknown message from ${guestName}: ${obj}`);
                        return;
                    }
                    dataChannel.send(JSON.stringify(hostMsg));
                };

				const dataChannels = GuestPeer.createDataChannels(rtc, this.dataChannelInits);
				rtc.onconnectionstatechange = () => {
					switch (rtc.connectionState) {
						case 'new':
							break;
						case 'connecting':
							this.connectingCallback(guestName);
							break;
						case 'connected':
							delete this.connectingGuests[guestName];
							this.addRtcAsHost(guestName, rtc, dataChannels, hostRoomChannel);
							break;
						case 'disconnected':
						case 'closed':
						case 'failed':
							delete this.connectingGuests[guestName];
							break;
						default:
							delete this.connectingGuests[guestName];
							console.error(`Unknown connection state: ${rtc.connectionState}`);
							break;
					}
				};
				rtc.onicecandidate = ({ candidate }) => {
					const outMsg: Record<string, SignalingHostConnectionMessage> = {};
					outMsg[guestName] = { ice: candidate };
					this.sendToConnectingGuests(outMsg);
				};
				const sdp = msg.offer;
				const task = async () => {
					await rtc.setRemoteDescription(sdp);
					this.connectingGuests[guestName] = {
                        provideIce: (ice) => {
                            rtc.addIceCandidate(ice ?? undefined);
                        }
                    };
					const answer = await rtc.createAnswer();
					return { answer };
				};
				tasks[guestName] = task();
			} else {
				console.warn(`Empty message from guest ${guestName}`);
			}
		}
		const outMsgs: Record<string, SignalingHostConnectionMessage> = {};
		for (const [guestName, task] of Object.entries(tasks)) {
			outMsgs[guestName] = await task;
		}
		this.sendToConnectingGuests(outMsgs);
	}

	private addRtcAsHost(
		peerName: string,
		rtc: RTCPeerConnection,
		dataChannels: Record<string, RTCDataChannel>,
		hostRoomChannel: RTCDataChannel
	): void {
		this.addRtc(peerName, rtc, dataChannels);
        this.hostRoomDataChannels[peerName] = hostRoomChannel;

        const connectedPeers = Object.keys(this.hostRoomDataChannels);
        for (const dataChannel of Object.values(this.hostRoomDataChannels)) {
            const msg: RtcHostConnectionMessage = { connectedPeers };
            dataChannel.send(JSON.stringify(msg));
        }
	}

    protected onPeerDisconnect(peerName: string): void {
        super.onPeerDisconnect(peerName);
        delete this.hostRoomDataChannels[peerName];
    }
}
