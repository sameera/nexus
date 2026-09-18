/**
 * The renderer as a serverless function. This is the whole of what a Lambda Function URL adds:
 * one event translated into the request the handler already answers, and one response
 * translated back. It holds nothing between invocations — a warm instance answers a reader
 * exactly as a cold one does (invariant 1 of decision record #653).
 */
import { dependenciesFromEnvironment } from "./environment.js";
import { handleRequest, type HandlerDependencies } from "./handler.js";

/** The parts of a Function URL event the renderer reads. Nothing else is consulted. */
export interface FunctionUrlEvent {
    readonly version?: string;
    readonly rawPath?: string;
    readonly rawQueryString?: string;
    /** A Function URL delivers cookies here, not as a header. */
    readonly cookies?: readonly string[];
    readonly headers?: Readonly<Record<string, string | undefined>>;
    readonly requestContext?: { readonly http?: { readonly method?: string } };
}

export interface FunctionUrlResult {
    readonly statusCode: number;
    readonly headers: Record<string, string>;
    /** Where a Function URL takes what the response sets on the browser. */
    readonly cookies: string[];
    readonly body: string;
    readonly isBase64Encoded: boolean;
}

/**
 * The handler reads no hostname of its own out of a request, so the name here is a placeholder
 * that is never part of an answer. It is what lets the same code be correct at whatever
 * address the team points its link template at (invariant 9).
 */
const PLACEHOLDER_HOST = "https://renderer.invalid";

export async function answerEvent(
    event: FunctionUrlEvent,
    dependencies: HandlerDependencies,
): Promise<FunctionUrlResult> {
    const answered = await handleRequest(requestFrom(event), dependencies);

    const headers = Object.fromEntries(answered.headers);
    // Every cookie travels in the field below; leaving one here would set it twice.
    delete headers["set-cookie"];

    return {
        statusCode: answered.status,
        headers,
        cookies: answered.headers.getSetCookie(),
        body: await answered.text(),
        isBase64Encoded: false,
    };
}

function requestFrom(event: FunctionUrlEvent): Request {
    const query = (event.rawQueryString ?? "").length > 0 ? `?${event.rawQueryString}` : "";
    const headers = new Headers(
        Object.entries(event.headers ?? {}).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
    );

    // The cookies a Function URL split out are put back as the one header the handler reads.
    const cookies = event.cookies ?? [];
    if (cookies.length > 0) headers.set("cookie", cookies.join("; "));

    return new Request(new URL(`${event.rawPath ?? "/"}${query}`, PLACEHOLDER_HOST), {
        method: "GET",
        headers,
    });
}

/**
 * What the deployed function is pointed at. The dependencies are assembled per invocation, so
 * nothing an earlier reader was answered with is held for the next one.
 */
export async function lambdaHandler(event: FunctionUrlEvent): Promise<FunctionUrlResult> {
    return await answerEvent(event, dependenciesFromEnvironment(process.env));
}
