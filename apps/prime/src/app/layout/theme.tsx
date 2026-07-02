import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import type { ReactElement, ReactNode } from "react";

/*
 * The theme mode owned by the shell (Story 8). Story 1 built the dual-mode token
 * mechanism — one semantic vocabulary, two value sets, selected by `data-theme`
 * on the shell root; this holds the active mode as runtime state so a single flip
 * re-resolves every region with zero per-region branching.
 *
 * Resolution order (decision record): a persisted explicit choice wins; with no
 * prior choice, follow the OS `prefers-color-scheme`, defaulting to dark when the
 * OS expresses no preference (the original mockup). The choice is persisted to
 * `localStorage` on toggle and read back on mount, so a reload restores it.
 */

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "prime-theme";

function readInitialTheme(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
        return stored;
    }
    // `?.` guards environments (e.g. jsdom) with no matchMedia — no match falls
    // through to dark, which is also the "OS expresses no preference" default.
    return window.matchMedia?.("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
}

interface ThemeContextValue {
    /* The active theme mode, applied at the shell root as `data-theme`. */
    theme: ThemeMode;
    /* Flip to the other mode and persist the choice. */
    toggleTheme: () => void;
}

/* A non-throwing default lets a region render in isolation without a provider. */
const ThemeContext = createContext<ThemeContextValue>({
    theme: "dark",
    toggleTheme: () => undefined,
});

export function ThemeProvider({
    children,
}: {
    children: ReactNode;
}): ReactElement {
    const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);

    const toggleTheme = useCallback(() => {
        setTheme((current) => {
            const next: ThemeMode = current === "dark" ? "light" : "dark";
            localStorage.setItem(STORAGE_KEY, next);
            return next;
        });
    }, []);

    const value = useMemo<ThemeContextValue>(
        () => ({ theme, toggleTheme }),
        [theme, toggleTheme],
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    return useContext(ThemeContext);
}
