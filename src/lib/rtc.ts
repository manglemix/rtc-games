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

	public isConnectedTo(peerName: string): boolean {
		return this.rtcConnections[peerName] !== undefined;
	}

	public getPeerNames(): string[] {
		return Object.keys(this.rtcConnections);
	}

	protected disconnectFrom(peerName: string): void {
		const rtc = this.rtcConnections[peerName];
		if (rtc === undefined) {
			return;
		}
		// Should trigger disconnection/close event
		rtc.close();
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
		dataChannelInits: DataChannelInit[],
		hostConnection = false
	): Record<string, RTCDataChannel> {
		const dataChannels: Record<string, RTCDataChannel> = {};
		for (const [id, dataChannelInit] of dataChannelInits.entries()) {
			if (dataChannelInit.hostOnly && !hostConnection) {
				continue;
			}
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

export interface RtcHostConnectionMessage {
    readonly connectedPeers?: string[];
    readonly ice?: {
        candidate: RTCIceCandidate | null;
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

export interface RtcGuestConnectionMessage {
    readonly ice?: RTCIceCandidate | null;
    readonly offer?: RTCSessionDescriptionInit;
    readonly answer?: RTCSessionDescriptionInit;
    readonly recipient: string;
}