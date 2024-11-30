// place files you want to import through the `$lib` alias in this folder.
/**
 * A seeded RNG
 * @param a
 * @param b
 * @param c
 * @param d
 * @returns
 */
export function sfc32(a: number, b: number, c: number, d: number) {
	return function () {
		a |= 0;
		b |= 0;
		c |= 0;
		d |= 0;
		let t = (((a + b) | 0) + d) | 0;
		d = (d + 1) | 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) | 0;
		c = (c << 21) | (c >>> 11);
		c = (c + t) | 0;
		return (t >>> 0) / 4294967296;
	};
}

export function cyrb128(str: string) {
	let h1 = 1779033703,
		h2 = 3144134277,
		h3 = 1013904242,
		h4 = 2773480762;
	for (let i = 0, k; i < str.length; i++) {
		k = str.charCodeAt(i);
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	(h1 ^= h2 ^ h3 ^ h4), (h2 ^= h1), (h3 ^= h1), (h4 ^= h1);
	return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function sfc32StrSeeded(str: string) {
	var seed = cyrb128(str);
	return sfc32(seed[0], seed[1], seed[2], seed[3]);
}
/**
 * An RNG that doesn't produce duplicates for the first 2^32 numbers
 * @param seed
 * @returns
 */
export function splitmix32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x9e3779b9) | 0;
		let t = seed ^ (seed >>> 16);
		t = Math.imul(t, 0x21f0aaad);
		t = t ^ (t >>> 15);
		t = Math.imul(t, 0x735a2d97);
		return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
	};
}

export class Vector2 {
	public x = $state(0);
	public y = $state(0);

	public constructor(x?: number, y?: number) {
		this.x = x ?? 0;
		this.y = y ?? 0;
	}

	public static copy(other: Vector2) {
		return new Vector2(other.x, other.y);
	}

	public add(other: Vector2) {
		return new Vector2(this.x + other.x, this.y + other.y);
	}

	public sub(other: Vector2) {
		return new Vector2(this.x - other.x, this.y - other.y);
	}

	public mul(scalar: number) {
		return new Vector2(this.x * scalar, this.y * scalar);
	}

	public div(scalar: number) {
		return new Vector2(this.x / scalar, this.y / scalar);
	}

	public dot(other: Vector2) {
		return this.x * other.x + this.y * other.y;
	}

	public lengthSquared() {
		return this.x * this.x + this.y * this.y;
	}

	public length() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}

	public normalize() {
		if (this.x === 0 && this.y === 0) {
			return new Vector2(0, 0);
		}
		return this.div(this.length());
	}

	public abs() {
		return new Vector2(Math.abs(this.x), Math.abs(this.y));
	}

	public sign() {
		return new Vector2(Math.sign(this.x), Math.sign(this.y));
	}

	public round() {
		return new Vector2(Math.round(this.x), Math.round(this.y));
	}

	public floor() {
		return new Vector2(Math.floor(this.x), Math.floor(this.y));
	}

	public ceil() {
		return new Vector2(Math.ceil(this.x), Math.ceil(this.y));
	}

	public rotate(angle: number) {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		return new Vector2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
	}

	public toString() {
		return `(${this.x}, ${this.y})`;
	}

	public equals(other: Vector2) {
		return this.x === other.x && this.y === other.y;
	}

	public toJSON() {
		return { x: this.x, y: this.y };
	}

	public static fromJSON(json: { x: number; y: number }) {
		return new Vector2(json.x, json.y);
	}
}

export function shuffle(array: any[], rng = Math.random) {
	let currentIndex = array.length;

	// While there remain elements to shuffle...
	while (currentIndex != 0) {
		// Pick a remaining element...
		let randomIndex = Math.floor(rng() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}
}
