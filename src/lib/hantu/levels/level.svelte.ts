export interface Level {
    readonly backgroundUrl: string;
    readonly collisionMaskUrl: string;
    readonly width: number;
    readonly height: number;
}

export const DEBUG_LEVEL: Level = {
    backgroundUrl: "/hantu/among-us-map-979738868.jpg",
    collisionMaskUrl: "/hantu/among-us-map-979738868-collision.png",
    width: 1418,
    height: 824
};