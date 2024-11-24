import { createClient } from 'redis';
import { RTC_KV_URL, RTC_KV_PORT, RTC_KV_TOKEN } from '$env/static/private';

export type SdpOffer = { sdp: RTCSessionDescriptionInit, ices: RTCIceCandidate[] };
export type SdpAnswer = { sdp: RTCSessionDescriptionInit };

export async function writeSdpOffer(gameName: string, offer: SdpOffer) {
    const rtc_kv = createClient({
        password: RTC_KV_TOKEN,
        socket: {
            host: RTC_KV_URL,
            port: RTC_KV_PORT
        }
    });
    await rtc_kv.connect();
    // Generate a random 6 digit alphanumeric string
    const passkey = Math.random().toString(36).substring(2, 8);
    await rtc_kv.set(`offers:${gameName}:${passkey}`, JSON.stringify(offer));
    await rtc_kv.expire(`offers:${gameName}:${passkey}`, 300);
    console.log(passkey);
    return passkey;
}


export async function getSdpOffer(gameName: string, passkey: string) {
    const rtc_kv = createClient({
        password: RTC_KV_TOKEN,
        socket: {
            host: RTC_KV_URL,
            port: RTC_KV_PORT
        }
    });
    await rtc_kv.connect();
    const offerStr: string | null = await rtc_kv.del(`offers:${gameName}:${passkey}`);
    if (offerStr === null) {
        return null;
    }
    rtc_kv.del(`offers:${gameName}:${passkey}`);
    const offer: SdpOffer = JSON.parse(offerStr);
    return offer;
}


export async function writeSdpAnswer(gameName: string, answer: SdpAnswer) {
    const rtc_kv = createClient({
        password: RTC_KV_TOKEN,
        socket: {
            host: RTC_KV_URL,
            port: RTC_KV_PORT
        }
    });
    await rtc_kv.connect();
    // Generate a random 6 digit alphanumeric string
    const passkey = Math.random().toString(36).substring(2, 8);
    await rtc_kv.set(`answers:${gameName}:${passkey}`, JSON.stringify(answer));
    await rtc_kv.expire(`answers:${gameName}:${passkey}`, 300);
    console.log(passkey);
    return passkey;
}


export async function getSdpAnswer(gameName: string, passkey: string) {
    const rtc_kv = createClient({
        password: RTC_KV_TOKEN,
        socket: {
            host: RTC_KV_URL,
            port: RTC_KV_PORT
        }
    });
    await rtc_kv.connect();
    const answerStr: string | null = await rtc_kv.del(`answers:${gameName}:${passkey}`);
    if (answerStr === null) {
        return null;
    }
    // rtc_kv.del(`offers:${gameName}:${passkey}`);
    const answer: SdpAnswer = JSON.parse(answerStr);
    return answer;
}