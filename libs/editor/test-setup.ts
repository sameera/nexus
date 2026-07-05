import "@testing-library/jest-dom/vitest";

/*
 * jsdom has no layout engine. After an edit, Lexical scrolls the selection into
 * view and calls getBoundingClientRect / getClientRects on the selection's
 * Range; jsdom leaves those unimplemented on Range, so the calls throw. Shim
 * them to zero-rects so editor updates (typing, submit-clear) run without noise.
 */
const zeroRect: DOMRect = {
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
};

const emptyRectList = Object.assign([] as DOMRect[], {
    item: () => null,
}) as unknown as DOMRectList;

const rangeProto = Range.prototype as unknown as {
    getBoundingClientRect?: () => DOMRect;
    getClientRects?: () => DOMRectList;
};

if (typeof rangeProto.getBoundingClientRect !== "function") {
    rangeProto.getBoundingClientRect = () => zeroRect;
}
if (typeof rangeProto.getClientRects !== "function") {
    rangeProto.getClientRects = () => emptyRectList;
}
