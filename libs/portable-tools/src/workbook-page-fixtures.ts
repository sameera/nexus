/**
 * How a workbook page is read in a spec (epic #405, decision record #450, invariant 21).
 *
 * Renderer behaviour is asserted as a learner perceives a page — the words on it, what is
 * emphasised, where a link goes, what the reveal control shows, what reaches the paper — and never
 * through the internal shape of the emitted markup. A spec that pins tag names and class attributes
 * fails when the markup is rearranged and passes when the page stops being readable, which is
 * exactly backwards.
 *
 * This module is the one place that knows what the markup looks like. It parses a page the way a
 * browser does and hands the spec back what a reader would report, so a spec never has to name a
 * tag. Rearranging the markup changes this file; it changes no spec.
 *
 * Spec-only: it is read by the workbook specs, which run in the browser-like environment
 * (`@vitest-environment jsdom`) this module's parsing needs. Nothing the toolkit ships imports it.
 */

/** A link as a reader meets it: the words they click, and where it takes them. */
export interface PageLink {
    label: string;
    href: string;
}

/** A script the page loads, and whether it needs a module loader (which a file:// page has none of). */
export interface PageScript {
    src: string;
    module: boolean;
}

/** A control that reveals content already on the page — what a widget looks like to a learner. */
export interface RevealControl {
    /** The words on the control before anything is revealed. */
    label: string;
    /** Whether the content is showing at rest. */
    showing: boolean;
    /** The content the control reveals. It is in the page whether or not it is showing. */
    content: string;
}

/** Everything a spec is allowed to know about a rendered page. */
export interface ReadPage {
    /** The page's name, as a browser tab shows it. */
    title: string;
    /** Every word a reader can read on the page, including content a control has yet to reveal. */
    text: string;
    /** Only the words showing before the reader touches anything. */
    visibleText: string;
    headings: string[];
    listItems: string[];
    links: PageLink[];
    /** Words the page stresses. */
    emphasised: string[];
    /** Text the page shows as code rather than as prose. */
    code: string[];
    /** The lessons the page offers to navigate to, or null when it offers no navigation. */
    navigation: string[] | null;
    /** What the page says about where it came from, both to a reader and to a reader of the diff. */
    provenance: string;
    /** What the file says before anything a browser renders — what a reviewer meets first. */
    firstContent: string;
    /** Every URL the browser must resolve to display the page completely. */
    assets: string[];
    stylesheets: string[];
    scripts: PageScript[];
    controls: RevealControl[];
    /** The furniture every page of the workbook shares, with this lesson's own content removed. */
    chrome: {
        navigation: string[] | null;
        stylesheets: string[];
        scripts: PageScript[];
        provenanceShape: string;
    };
}

function normalise(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

function textOf(nodes: Iterable<Element>): string[] {
    return [...nodes].map((n) => normalise(n.textContent ?? ""));
}

/** True when the element, or anything it sits inside, is hidden before the reader acts. */
function hiddenAtRest(element: Element | null): boolean {
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
        if (node.hasAttribute("hidden")) return true;
    }
    return false;
}

/** Read a rendered page the way a browser presents it to a learner. */
export function readPage(html: string): ReadPage {
    const doc: Document = new DOMParser().parseFromString(html, "text/html");

    const controls: RevealControl[] = [...doc.querySelectorAll("button[aria-expanded]")].map((control) => {
        const container: Element | null = control.parentElement;
        const revealed: Element | null = container?.querySelector("[hidden], [aria-hidden]") ?? null;
        return {
            label: normalise(control.textContent ?? ""),
            showing: control.getAttribute("aria-expanded") === "true",
            content: normalise(revealed?.textContent ?? ""),
        };
    });

    const visible: string[] = [];
    for (const element of doc.body.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, footer, button")) {
        if (!hiddenAtRest(element)) visible.push(normalise(element.textContent ?? ""));
    }

    const navList: Element | null = doc.querySelector("nav");
    const navigation: string[] | null = navList === null ? null : textOf(navList.querySelectorAll("li"));

    const stylesheets: string[] = [...doc.querySelectorAll("link[rel='stylesheet']")].map((l) => l.getAttribute("href") ?? "");
    const scripts: PageScript[] = [...doc.querySelectorAll("script[src]")].map((s) => ({
        src: s.getAttribute("src") ?? "",
        module: s.getAttribute("type") === "module",
    }));
    const assets: string[] = [
        ...stylesheets,
        ...scripts.map((s) => s.src),
        ...[...doc.querySelectorAll("img[src], source[src], iframe[src]")].map((e) => e.getAttribute("src") ?? ""),
    ];

    const comments: string[] = [];
    const walker: TreeWalker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        comments.push(normalise(node.textContent ?? ""));
    }
    const spoken: string = normalise([...doc.querySelectorAll("footer")].map((f) => f.textContent ?? "").join(" "));
    const provenance: string = [comments.join(" "), spoken].filter((part) => part !== "").join(" ");

    const beforeDoctype: number = html.toLowerCase().indexOf("<!doctype");
    const firstContent: string = beforeDoctype === -1 ? html : html.slice(0, beforeDoctype);

    // The lesson's own words are its title and its file name; taking both out of the provenance
    // sentence leaves the shape every page of the workbook shares.
    const title: string = doc.title;
    const provenanceShape: string = provenance
        .replace(/\S+\.mdx?/g, "<lesson>")
        .replace(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "<title>");

    return {
        title,
        text: normalise(doc.body.textContent ?? ""),
        visibleText: visible.join(" "),
        headings: textOf(doc.querySelectorAll("h1, h2, h3, h4, h5, h6")),
        listItems: textOf(doc.querySelectorAll("main li")),
        links: [...doc.querySelectorAll("a[href]")].map((a) => ({
            label: normalise(a.textContent ?? ""),
            href: a.getAttribute("href") ?? "",
        })),
        emphasised: textOf(doc.querySelectorAll("strong, em, b, i")),
        code: textOf(doc.querySelectorAll("code, pre")),
        navigation,
        provenance,
        firstContent,
        assets,
        stylesheets,
        scripts,
        controls,
        chrome: { navigation, stylesheets, scripts, provenanceShape },
    };
}

/** One CSS rule inside the print block: what it selects, and what it sets. */
interface PrintRule {
    selectors: string[];
    declarations: Record<string, string>;
}

/** Everything the stylesheet says about what a page looks like on paper. */
export interface PrintedPage {
    /** True when the text is on the paper. */
    shows(text: string): boolean;
    /** The reading-surface values in force when printing — the ink, the paper and everything else. */
    colours: Record<string, string>;
}

/** Pull the print block out of a stylesheet and read its rules. */
function printRules(css: string): PrintRule[] {
    const rules: PrintRule[] = [];
    for (let at = css.indexOf("@media print"); at !== -1; at = css.indexOf("@media print", at + 1)) {
        let depth = 0;
        let start = -1;
        let end = -1;
        for (let i = css.indexOf("{", at); i < css.length && i !== -1; i++) {
            if (css[i] === "{") {
                depth += 1;
                if (depth === 1) start = i + 1;
            } else if (css[i] === "}") {
                depth -= 1;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        if (start === -1 || end === -1) continue;
        const block: string = css.slice(start, end);
        for (const match of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            const declarations: Record<string, string> = {};
            for (const declaration of match[2].split(";")) {
                const [property, ...value] = declaration.split(":");
                if (value.length === 0) continue;
                declarations[property.trim()] = value.join(":").replace("!important", "").trim();
            }
            rules.push({ selectors: match[1].split(",").map((s) => s.trim()).filter((s) => s !== ""), declarations });
        }
    }
    return rules;
}

/**
 * Read a page as the printer puts it on paper: the stylesheet's print rules applied to the page,
 * so a spec can ask what a reader holds in their hand rather than what a declaration says.
 */
export function printPage(html: string, css: string): PrintedPage {
    const doc: Document = new DOMParser().parseFromString(html, "text/html");
    const rules: PrintRule[] = printRules(css);

    const displayOf = (element: Element): string => {
        let display: string | null = null;
        for (const rule of rules) {
            for (const selector of rule.selectors) {
                if (rule.declarations["display"] !== undefined && element.matches(selector)) {
                    display = rule.declarations["display"];
                }
            }
        }
        if (display !== null) return display;
        return element.hasAttribute("hidden") ? "none" : "block";
    };

    const onPaper = (element: Element): boolean => {
        for (let node: Element | null = element; node !== null; node = node.parentElement) {
            if (displayOf(node) === "none") return false;
        }
        return true;
    };

    const colours: Record<string, string> = {};
    for (const rule of rules) {
        if (!rule.selectors.some((s) => s === ":root" || s.startsWith("[data-theme"))) continue;
        for (const [property, value] of Object.entries(rule.declarations)) {
            if (property.startsWith("--")) colours[property] = value;
        }
    }

    return {
        shows(text: string): boolean {
            for (const element of doc.querySelectorAll("*")) {
                if (!normalise(element.textContent ?? "").includes(normalise(text))) continue;
                if (element.children.length === 0 || element.querySelector("*") === null) {
                    if (onPaper(element)) return true;
                } else if ([...element.children].every((c) => !normalise(c.textContent ?? "").includes(normalise(text)))) {
                    if (onPaper(element)) return true;
                }
            }
            return false;
        },
        colours,
    };
}
