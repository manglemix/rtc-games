import { popGuestMessages } from "$lib/rtc-server";
import type { RequestHandler } from "@sveltejs/kit";

export const DELETE: RequestHandler = popGuestMessages;