import type { DataChannelInit, NetworkClient } from "$lib/rtc-client";

export const DATA_CHANNELS: DataChannelInit[] = [
    {
        label: "game-state",
        hostOnly: true,
    },
    {
        label: "player-state",
    }
];

export class GameState {
    private netClient: NetworkClient;
    
    public constructor(netClient: NetworkClient) {
        this.netClient = netClient;
    }
}