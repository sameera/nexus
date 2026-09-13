/**
 * The slice of jsdom the workbook specs use to open a rendered page and run its shipped script as a
 * learner's browser would. jsdom ships no types of its own, and nothing the toolkit ships imports it.
 */
declare module "jsdom" {
    export interface JSDOMOptions {
        runScripts?: "outside-only" | "dangerously";
        pretendToBeVisual?: boolean;
    }
    export class JSDOM {
        constructor(html: string, options?: JSDOMOptions);
        readonly window: Window & typeof globalThis & { eval(code: string): unknown };
    }
}
