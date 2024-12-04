import { closeRoom } from '$lib/rtc-server';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = closeRoom;
