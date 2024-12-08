import {
	NetworkPeer,
	rtcConfig,
	type DataChannelInits,
	type QueryResponse,
	type RtcGuestConnectionMessage,
	type RtcHostConnectionMessage,
	type SignalingGuestConnectionMessage,
	type SignalingHostConnectionMessage
} from './rtc';


export class HostPeer extends NetworkPeer {
	private hostRoomDataChannels: Record<string, RTCDataChannel> = {};
	private onQuery?: (peerName: string, response: QueryResponse) => void;

	public constructor(
		name: string,
		public sendToConnectingGuests: (msgs: Record<string, SignalingHostConnectionMessage>) => void,
		dataChannelInits: DataChannelInits
	) {
		super(name, name, true, dataChannelInits);
		this.onIceCandidate = (peerName, ice) => {
			this.sendToConnectingGuests({ [peerName]: { ice } });
		}
		this.onSdp = (peerName, answer) => {
			if (answer.type !== 'answer') {
				console.error(`Expected answer, got ${answer.type}`);
				return;
			}
			this.sendToConnectingGuests({ [peerName]: { answer } });
		}
	}

	public acceptGuestConnectionMessages(
		msgs: SignalingGuestConnectionMessage[]
	): void {
		for (const msg of msgs) {
			if (msg.ice) {
				this.addIceCandidate(msg.from, msg.ice);
			} else if (msg.offer) {
				this.addSdp(msg.from, msg.offer);
			}
		}
	}
	public async queryReadiness(): Promise<boolean> {
		if (this.onQuery) {
			console.error('Query already in progress');
			return false;
		}
		
		return await new Promise((resolve) => {
			const handled = Object.fromEntries(this.getPeerNames().map((name) => [name, false]));
			this.onQuery = (peerName, response) => {
				if (response.query === "connectedPeers") {
					const expectedConnected = new Set(this.getPeerNames());
					const actualConnected = new Set(response.connectedPeers);

					if (expectedConnected.size !== actualConnected.size) {
						this.onQuery = undefined;
						resolve(false);
						return;
					}

					for (const name of expectedConnected) {
						if (!actualConnected.has(name)) {
							this.onQuery = undefined;
							resolve(false);
							return;
						}
					}

					handled[peerName] = true;

					if (Object.values(handled).every((v) => v)) {
						this.onQuery = undefined;
						resolve(true);
					}
				}
			};
			
		});
	}

	protected async addRtc(peerName: string, rtc: RTCPeerConnection, dataChannels: Record<string, RTCDataChannel>): Promise<void> {
		super.addRtc(peerName, rtc, dataChannels);
		const hostRoomChannel = dataChannels["host-room"]!;
		this.hostRoomDataChannels[peerName] = hostRoomChannel;

		hostRoomChannel.onmessage = (msg) => {
			const obj: RtcGuestConnectionMessage = JSON.parse(msg.data);
			const dataChannel = this.hostRoomDataChannels[obj.recipient];
			if (dataChannel === undefined) {
				console.error(`No data channel to ${obj.recipient} (requested by ${peerName})`);
				return;
			}
			let hostMsg: RtcHostConnectionMessage;
			if (obj.ice !== undefined) {
				hostMsg = { ice: { candidate: obj.ice, from: peerName } };
			} else if (obj.sdp) {
				hostMsg = { sdp: { sdp: obj.sdp, from: peerName } };
			} else {
				console.error(`Unknown message from ${peerName}: ${obj}`);
				return;
			}
			dataChannel.send(JSON.stringify(hostMsg));
		};

		if (hostRoomChannel.readyState !== 'open') {
			await new Promise((resolve) => {
				hostRoomChannel.onopen = resolve;
			});
		}

		const connectedPeers = Object.keys(this.hostRoomDataChannels);
		connectedPeers.push(this.name);
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
