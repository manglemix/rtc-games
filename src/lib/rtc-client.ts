export type SdpOffer = { sdp: RTCSessionDescriptionInit, ices: RTCIceCandidate[] };


class NetworkPeer {
    private rtc: RTCPeerConnection = new RTCPeerConnection();
    private rtcConnChannel: RTCDataChannel | null = null;
    private dataChannels: Map<string, RTCDataChannel> = new Map();
    private connectionPhase = false;

    private constructor() {
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
    static async createHost(onSdpOffer: (newPeerName: string, offer: SdpOffer) => void, dataChannels: DataChannelInit[], onHostPrematureClose: () => void) {
        const peer = new NetworkPeer();
        peer.rtcConnChannel = peer.rtc.createDataChannel("rtc-conn", { negotiated: true, id: 0 });
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
            peer.createDataChannel(dataChannelInit.label, { negotiated: true, id: id + 1, ...dataChannelInit });
        }
    
        return {
            peer,
            offer: await peer.createSdpOffer()
        };
    };

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
            peer.createDataChannel(dataChannelInit.label, { negotiated: true, id: id + 1, ...dataChannelInit });
        }
    
        return {
            peer,
            offer: await peer.createSdpOffer()
        };
    };

    /**
     * Accept an offer from a peer as the host.
     * 
     * @param offer 
     * @param onGuestPrematureClose 
     * @returns 
     */
    static async acceptOfferAsHost(offer: SdpOffer, dataChannels: DataChannelInit[], onGuestPrematureClose: () => void) {
        const peer = new NetworkPeer();
        peer.rtcConnChannel = peer.rtc.createDataChannel("rtc-conn", { negotiated: true, id: 0 });
        peer.rtcConnChannel.onclosing = () => {
            if (peer.connectionPhase) {
                onGuestPrematureClose();
            }
            peer.rtcConnChannel = null;
        };
        for (const [id, dataChannelInit] of dataChannels.entries()) {
            peer.createDataChannel(dataChannelInit.label, { negotiated: true, id: id + 1, ...dataChannelInit });
        }
        await peer.rtc.setRemoteDescription(offer.sdp);

        return {
            peer,
            answer: await peer.rtc.createAnswer()
        };
    };

    /**
     * Accept an offer from a peer as a guest.
     * 
     * @param offer 
     * @param onGuestPrematureClose 
     * @returns 
     */
    static async acceptOfferAsGuest(offer: SdpOffer, dataChannels: DataChannelInit[], onGuestPrematureClose: () => void) {
        const peer = new NetworkPeer();
        for (const [id, dataChannelInit] of dataChannels.entries()) {
            peer.createDataChannel(dataChannelInit.label, { negotiated: true, id: id + 1, ...dataChannelInit });
        }
        await peer.rtc.setRemoteDescription(offer.sdp);

        return {
            peer,
            answer: await peer.rtc.createAnswer()
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
            console.error("RTC connection channel is null");
        } else {
            this.rtcConnChannel.send(JSON.stringify({ newPeerName, offer }));
        }
    }

    private async createSdpOffer(enableAudio: boolean = false) {
        var mediaConstraints = {
            'offerToReceiveAudio': enableAudio,
            'offerToReceiveVideo': false    
        };
    
        const offer = await this.rtc.createOffer(mediaConstraints);
        await this.rtc.setLocalDescription(offer);
    
        let ices: RTCIceCandidate[] = [];
        const finished: Promise<SdpOffer> = new Promise((resolve) => {
            this.rtc.onicecandidate = (event) => {
                if (event.candidate === null || event.candidate.candidate === "") {
                    resolve({
                        sdp: offer,
                        ices
                    });
                } else {
                    ices.push(event.candidate);
                }
            };
        });
    
        return await finished;
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
    ourName: string,
    advertisement: { peerNames: string[], hostName: string },
    dataChannels: DataChannelInit[],
    onHostPrematureClose: () => void,
    uploadAnswer: (newPeerName: string, answer: RTCSessionDescriptionInit) => void
};

export class NetworkClient {
    name: string;
    isHost: boolean;
    peers: Map<string, NetworkPeer> = new Map();
    dataChannels: DataChannelInit[];
    uploadAnswer: (newPeerName: string, answer: RTCSessionDescriptionInit) => void;
    public onGuestDisconnect: (peerName: string) => void = () => {};

    private constructor(name: string, isHost: boolean, dataChannels: DataChannelInit[], uploadAnswer: (newPeerName: string, answer: RTCSessionDescriptionInit) => void) {
        this.name = name;
        this.isHost = isHost;
        this.dataChannels = dataChannels;
        this.uploadAnswer = uploadAnswer
    }

    public static async connectToRoom(init: ConnectToRoomInit) {
        const client = new NetworkClient(init.ourName, false, init.dataChannels, init.uploadAnswer);
        const offers = new Map<string, SdpOffer>();
        for (const peerName of init.advertisement.peerNames) {
            const { peer, offer } = await NetworkPeer.createGuest(init.dataChannels);
            offers.set(peerName, offer);
            client.peers.set(peerName, peer);
        }
        const { peer, offer } = await NetworkPeer.createHost(
            client.acceptSdpOfferAsGuest,
            init.dataChannels,
            init.onHostPrematureClose
        );
        offers.set(init.advertisement.hostName, offer);
        client.peers.set(init.advertisement.hostName, peer);
        return {
            client,
            offers
        };
    }

    finishConnectionPhase() {
        for (const peer of this.peers.values()) {
            peer.finishConnectionPhase();
        }
    }

    public static createRoom(ourName: string, dataChannels: DataChannelInit[], uploadAnswer: (newPeerName: string, answer: RTCSessionDescriptionInit) => void) {
        return new NetworkClient(ourName, true, dataChannels, uploadAnswer);
    }

    public close() {
        for (const peer of this.peers.values()) {
            peer.close();
        }
        this.peers.clear();
    }

    public advertiseAsHost() {
        if (!this.isHost) {
            console.error("Advertising as host even though not host");
        }
        return {
            peerNames: Array.from(this.peers.keys()),
            hostName: this.name
        };
    }

    public async acceptSdpOffers(newPeerName: string, offers: Map<string, SdpOffer>) {
        if (!this.isHost) {
            console.error("Attempted to accept SDP offers even though not host");
            return false;
        }
        // Check if all names are accounted for and there are no extra names
        const peerNames = new Set(Array.from(this.peers.keys()));
        const offerNames = new Set(offers.keys());
        if ((peerNames.size + 1) !== offerNames.size) {
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

        for (const [peerName, offer] of offers) {
            if (peerName === this.name) {
                const { peer, answer } = await NetworkPeer.acceptOfferAsHost(offer, this.dataChannels, () => {
                    this.onGuestDisconnect(peerName);
                });
                peerToAdd = peer;
                this.uploadAnswer(peerName, answer);
            } else {
                this.peers.get(peerName)!.sendSdpOffer(newPeerName, offer);
            }
        }
        this.peers.set(newPeerName, peerToAdd!);

        return true;
    }

    private async acceptSdpOfferAsGuest(peerName: string, offer: SdpOffer) {
        if (this.isHost) {
            console.error("Attempted to accept single SDP offer as host");
            return;
        }
        const { peer, answer } = await NetworkPeer.acceptOfferAsGuest(offer, this.dataChannels, () => {
            this.onGuestDisconnect(peerName);
        });
        this.peers.set(peerName, peer);
        this.uploadAnswer(peerName, answer);
    }
}