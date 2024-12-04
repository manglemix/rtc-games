import { NetworkPeer, rtcConfig, type DataChannelInit, type RtcGuestConnectionMessage, type RtcHostConnectionMessage, type SignalingGuestConnectionMessage, type SignalingHostConnectionMessage } from "./rtc";


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
                    if (obj.ice !== undefined) {
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

				const dataChannels = NetworkPeer.createDataChannels(rtc, this.dataChannelInits, true);
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
                            console.error(`Unknown connection state: ${rtc.connectionState} from ${guestName}`);
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
                    rtc.setLocalDescription(answer);
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
