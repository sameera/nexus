/**
 * The shipped-without-a-pull-request marker (decision record #505, key decision "A story that
 * ships without its own pull request is excluded by a marker on the story issue"). One concept
 * shared with #213's close waiver — never two labels for the same fact — resolved through the
 * shared publishing resolver (`no-pr-label`, `@nexus/delivery-config/resolve`), never hard-coded.
 */

/** Whether a story issue's labels carry the resolved no-pull-request marker. */
export function isExcludedStory(labels: string[], noPrLabel: string): boolean {
    const wanted = noPrLabel.toLowerCase();
    return labels.some((name) => name.toLowerCase() === wanted);
}
