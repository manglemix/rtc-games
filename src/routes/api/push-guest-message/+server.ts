import { pushGuestMessage } from '$lib/rtc-server';
import type { RequestHandler } from '@sveltejs/kit';

export const PUT: RequestHandler = pushGuestMessage;