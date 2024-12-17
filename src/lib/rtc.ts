export interface DataChannelInit {
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

export type DataChannelInits = Record<string, DataChannelInit>;

interface ConnectingPeer {
	rtc: RTCPeerConnection;
	dataChannels: Record<string, RTCDataChannel>;
}

export abstract class NetworkPeer {
	/**
	 * A map of event handlers for each channel.
	 */
	public onMessage: Record<string, ((from: string, msg: MessageEvent) => void)[]> = {};

	/**
	 * A map of named data channels for each peer name.
	 */
	private dataChannels: Record<string, Record<string, RTCDataChannel>> = {};

	private rtcConnections: Record<string, RTCPeerConnection> = {};

	private connectingPeers: Record<string, ConnectingPeer> = {};

	public connectingCallback: (peerName: string) => void = () => {};
	public connectedCallback: (peerName: string) => void = () => {};
	public disconnectedCallback: (peerName: string) => void = () => {};

	protected onIceCandidate: (peerName: string, ice: RTCIceCandidate | null) => void = () => {};
	protected onSdp: (peerName: string, sdp: RTCSessionDescriptionInit) => void = () => {};

	protected constructor(
		public readonly name: string,
		public readonly hostName: string,
		public readonly isHost: boolean,
		public readonly dataChannelInits: DataChannelInits
	) {}

	public addOnMessage(
		channelName: string,
		handler: (from: string, msg: MessageEvent) => void
	): void {
		const messageHandlers = this.onMessage[channelName];
		if (messageHandlers === undefined) {
			this.onMessage[channelName] = [handler];
		} else {
			messageHandlers.push(handler);
		}
	}

	public clearOnMessageForChannel(channelName: string): void {
		delete this.onMessage[channelName];
	}

	public broadcast(channelName: string, msg: string): void {
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

	public isConnectedTo(peerName: string): boolean {
		return this.rtcConnections[peerName] !== undefined;
	}

	public getPeerNames(): string[] {
		return Object.keys(this.rtcConnections);
	}

	public close(): void {
		for (const rtc of Object.values(this.rtcConnections)) {
			rtc.close();
		}
		this.rtcConnections = {};
		this.dataChannels = {};
		this.onMessage = {};
	}

	private getConnectingPeer(peerName: string): ConnectingPeer | null {
		if (this.connectingPeers[peerName] === undefined) {
			if (this.rtcConnections[peerName] !== undefined) {
				console.error(`Already connected to ${peerName}`);
				return null;
			}
			const rtc = new RTCPeerConnection(rtcConfig);
			const dataChannels = NetworkPeer.createDataChannels(
				rtc,
				this.dataChannelInits,
				this.isHost || peerName === this.hostName
			);
			this.connectingPeers[peerName] = {
				rtc,
				dataChannels
			};

			rtc.onicecandidate = ({ candidate }) => {
				this.onIceCandidate(peerName, candidate);
			};

			rtc.onconnectionstatechange = () => {
				switch (rtc.connectionState) {
					case 'new':
					case 'connecting':
						break;
					case 'connected':
						delete this.connectingPeers[peerName];
						this.addRtc(peerName, rtc, dataChannels);
						break;
					case 'disconnected':
					case 'closed':
					case 'failed':
						delete this.connectingPeers[peerName];
						break;
					default:
						delete this.connectingPeers[peerName];
						console.error(`Unknown connection state: ${rtc.connectionState} from ${peerName}`);
						break;
				}
			};

			this.connectingCallback(peerName);
		}
		return this.connectingPeers[peerName];
	}

	protected addIceCandidate(peerName: string, ice: RTCIceCandidate | null): void {
		const peer = this.getConnectingPeer(peerName);
		if (peer === null) {
			return;
		}
		peer.rtc.addIceCandidate(ice ?? undefined);
	}

	protected addSdp(peerName: string, sdp: RTCSessionDescriptionInit): void {
		const peer = this.getConnectingPeer(peerName);
		if (peer === null) {
			return;
		}
		peer.rtc.setRemoteDescription(sdp);
		if (sdp.type === 'offer') {
			peer.rtc.createAnswer().then((answer) => {
				peer.rtc.setLocalDescription(answer);
				this.onSdp(peerName, answer);
			});
		}
	}

	protected disconnectFrom(peerName: string): void {
		const rtc = this.rtcConnections[peerName];
		if (rtc === undefined) {
			return;
		}
		// Should trigger disconnection/close event
		rtc.close();
	}

	protected createRtc(peerName: string): void {
		const peer = this.getConnectingPeer(peerName);
		if (peer === null) {
			return;
		}
		peer.rtc.createOffer().then((offer) => {
			peer.rtc.setLocalDescription(offer);
			this.onSdp(peerName, offer);
		});
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
					rtc.onconnectionstatechange = () => {};
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
				const messageHandlers = this.onMessage[channelName];
				if (messageHandlers !== undefined) {
					messageHandlers.forEach((handler) => handler(peerName, msg));
				}
			};
		}
		this.dataChannels[peerName] = dataChannels;
		this.rtcConnections[peerName] = rtc;
		this.connectedCallback(peerName);
	}

	protected static createDataChannels(
		rtc: RTCPeerConnection,
		dataChannelInits: DataChannelInits,
		hostConnection = false
	): Record<string, RTCDataChannel> {
		const dataChannels: Record<string, RTCDataChannel> = {};
		if (hostConnection) {
			dataChannels['host-room'] = rtc.createDataChannel('host-room', {
				negotiated: true,
				id: 0,
				ordered: true
			});
		}
		for (const [id, [label, dataChannelInit]] of Object.entries(dataChannelInits).entries()) {
			if (dataChannelInit.hostOnly && !hostConnection) {
				continue;
			}
			dataChannels[label] = rtc.createDataChannel(label, {
				negotiated: true,
				id: id + 1,
				...dataChannelInit
			});
		}
		return dataChannels;
	}

	protected onPeerDisconnect(peerName: string): void {
		// Retain onMessage handlers for reconnection
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
	readonly from: string;
}

export type QueryResponse = {
	query: 'connectedPeers';
	connectedPeers: string[];
};

export interface RtcHostConnectionMessage {
	readonly connectedPeers?: string[];
	readonly ice?: {
		candidate: RTCIceCandidate | null;
		from: string;
	};
	readonly sdp?: {
		sdp: RTCSessionDescriptionInit;
		from: string;
	};
	readonly query?: 'connectedPeers';
	readonly queryResponse?: QueryResponse;
}

export interface RtcGuestConnectionMessage {
	readonly ice?: RTCIceCandidate | null;
	readonly sdp?: RTCSessionDescriptionInit;
	readonly recipient: string;
}
