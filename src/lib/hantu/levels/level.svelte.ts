import { Vector2 } from '$lib/index.svelte';

export enum AreaType {
	DiningArea,
	Kitchen,
	Bedroom,
	Bathroom,
	Jail,
	Crypt
}

export interface Level {
	readonly backgroundUrl: string;
	readonly collisionMaskUrl: string;
	readonly width: number;
	readonly height: number;
	readonly voteOrigin: Vector2;
	readonly voteRadius: number;
	readonly visibleRadius: number;
	readonly cryptOrigin: Vector2;
	readonly jailOrigins: Vector2[];
	readonly playerSprites: string[];
	readonly playerHalfDimensions: Vector2[];
	readonly playerSpeed: number;
}

export const DEBUG_LEVEL: Level = {
	backgroundUrl: '/levels/hantu01/background.webp',
	collisionMaskUrl: '/levels/hantu01/collisions.webp',
	width: 1000,
	height: 1000,
	voteOrigin: new Vector2(500, 435),
	voteRadius: 80,
	visibleRadius: 200,
	cryptOrigin: new Vector2(500, 940),
	jailOrigins: [],
	playerSprites: ['/characters/hantu/player01.png'],
	playerHalfDimensions: [new Vector2(15, 15)],
	playerSpeed: 75
};
