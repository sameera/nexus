import { describe, expect, it, vi } from "vitest";

import { tokenExchange } from "./exchange.js";

function answering(body: unknown, status = 200) {
    return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("trading GitHub's returned code for the reader's own token", () => {
    it("gives back the token and the life GitHub gave it", async () => {
        const fetch = answering({ access_token: "ghu_reader", expires_in: 3600 });

        const grant = await tokenExchange(fetch, "Iv1.app", "the-secret")("the-code");

        expect(grant).toEqual({ token: "ghu_reader", expiresInSeconds: 3600 });
    });

    it("sends the code and the app's own credentials, and nothing else", async () => {
        const fetch = answering({ access_token: "ghu_reader", expires_in: 3600 });

        await tokenExchange(fetch, "Iv1.app", "the-secret")("the-code");

        const [address, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(new URL(address).origin).toBe("https://github.com");
        expect(JSON.parse(String(init.body))).toEqual({
            client_id: "Iv1.app",
            client_secret: "the-secret",
            code: "the-code",
        });
    });

    it("gives the token a stated life when GitHub names none", async () => {
        const fetch = answering({ access_token: "ghu_reader" });

        const grant = await tokenExchange(fetch, "Iv1.app", "the-secret")("the-code");

        expect(grant?.expiresInSeconds).toBeGreaterThan(0);
    });

    it("gives back nothing when GitHub will not complete the exchange", async () => {
        expect(
            await tokenExchange(answering({ error: "bad_verification_code" }, 401), "a", "b")("c"),
        ).toBeNull();
        expect(
            await tokenExchange(answering({ error: "bad_verification_code" }), "a", "b")("c"),
        ).toBeNull();
    });

    it("gives back nothing when GitHub's answer is not one it can read", async () => {
        const fetch = vi.fn(async () => new Response("not json", { status: 200 }));

        expect(await tokenExchange(fetch, "a", "b")("c")).toBeNull();
    });
});
