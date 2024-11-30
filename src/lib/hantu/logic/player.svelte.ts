import { Vector2 } from '$lib/index.svelte';
import ImageObj from 'image-js';
import { AreaType } from '../levels/level.svelte';

export class Player {
	protected _velocity: Vector2 = $state(new Vector2(0, 0));
	protected _origin: Vector2 = $state(new Vector2(200, 260));
	public alive = $state(true);

	_currentVote?: boolean = $state(undefined);
	_possessed = false;
	_isKeyHolder: boolean = false;

	public get currentVote() {
		return this._currentVote;
	}

	public get isKeyHolder() {
		return this._isKeyHolder;
	}

	public get possessed() {
		return this._possessed;
	}

	public get origin() {
		return this._origin;
	}

	public get velocity() {
		return this._velocity;
	}

	public set origin(newOrigin: Vector2) {
		this._origin = newOrigin;
	}

	public set velocity(newVelocity: Vector2) {
		this._velocity = newVelocity;
	}

	constructor(
		public readonly name: string,
		public readonly spriteUrl: string,
		public readonly spriteHalfDimensions: Vector2
	) {}

	process(delta: number) {
		this.origin = this.origin.add(this.velocity.mul(delta));
	}
}

export class ThisPlayer extends Player {
	public onEnterArea: (areaType: AreaType, areaId: number) => void = () => {};
	public onExitArea: (areaType: AreaType, areaId: number) => void = () => {};

	private collisionMask?: ImageObj;
	// 0 means no collision layer
	private currentCollisionLayer = 0;
	private currentAreaType = AreaType.DiningArea;

	constructor(
		collisionMaskUrl: string,
		name: string,
		spriteUrl: string,
		spriteHalfDimensions: Vector2
	) {
		super(name, spriteUrl, spriteHalfDimensions);
		ImageObj.load(collisionMaskUrl).then((img) => {
			this.collisionMask = img;
		});
	}

	public setVote(vote: boolean) {
		this._currentVote = vote;
	}

	process(delta: number) {
		const step = this.velocity.mul(delta);
		if (this.collisionMask) {
			let stepAbs = step.abs();
			const sign = step.sign();
			const toCheck = this.origin;
			while (stepAbs.x > 0) {
				const oldToCheckX = toCheck.x;
				if (stepAbs.x >= 1) {
					stepAbs.x -= 1;
					toCheck.x += sign.x;
				} else {
					toCheck.x += stepAbs.x * sign.x;
					stepAbs.x = 0;
				}
				const px = this.collisionMask.getPixelXY(Math.round(toCheck.x), Math.round(toCheck.y));
				if (px[3] === 0) {
					continue;
				}
				if (px[0] === 0) {
					this.velocity.x = 0;
					toCheck.x = oldToCheckX;
					break;
				}
			}
			while (stepAbs.y > 0) {
				const oldToCheckY = toCheck.y;
				if (stepAbs.y >= 1) {
					stepAbs.y -= 1;
					toCheck.y += sign.y;
				} else {
					toCheck.y += stepAbs.y * sign.y;
					stepAbs.y = 0;
				}
				const px = this.collisionMask.getPixelXY(Math.round(toCheck.x), Math.round(toCheck.y));
				if (px[3] === 0) {
					continue;
				}
				if (px[0] === 0) {
					this.velocity.y = 0;
					toCheck.y = oldToCheckY;
					break;
				}
			}
			this.origin = toCheck;
			const px = this.collisionMask.getPixelXY(Math.round(toCheck.x), Math.round(toCheck.y));
			const newLayer = px[3] === 0 ? 0 : px[0];
			if (newLayer !== this.currentCollisionLayer) {
				if (this.currentCollisionLayer !== 0) {
					this.onExitArea(this.currentAreaType, this.currentCollisionLayer);
				}
				this.currentAreaType = px[1] as AreaType;
				this.currentCollisionLayer = newLayer;
				if (newLayer !== 0) {
					this.onEnterArea(this.currentAreaType, newLayer);
				}
			}
		} else {
			this.origin = this.origin.add(step);
		}
	}
}
