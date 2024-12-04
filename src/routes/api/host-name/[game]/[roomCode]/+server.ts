import { getHostName } from "$lib/rtc-server";
import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = getHostName;