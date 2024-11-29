import { Vector2 } from '$lib/index.svelte';

export interface Level {
	readonly backgroundUrl: string;
	readonly collisionMaskUrl: string;
	readonly width: number;
	readonly height: number;
	readonly voteOrigin: Vector2;
	readonly voteRadius: number;
	readonly visibleRadius: number;
	readonly bedroomMaskUrls: string[];
	readonly kitchenMaskUrl: string;
	readonly diningRoomMaskUrl: string;
	readonly cryptMaskUrl: string;
	readonly cryptOrigin: Vector2;
	readonly bathroomMaskUrls: string[];
	readonly jailMaskUrl: string;
}

export const DEBUG_LEVEL: Level = {
	backgroundUrl: '/hantu/among-us-map-979738868.jpg',
	collisionMaskUrl: '/hantu/among-us-map-979738868-collision.png',
	width: 1418,
	height: 824,
	voteOrigin: new Vector2(400, 200),
	voteRadius: 20,
	visibleRadius: 200
};
