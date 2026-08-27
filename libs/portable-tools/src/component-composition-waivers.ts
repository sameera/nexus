/**
 * The waiver register for the payload-composition check (decision record #277). A component file
 * listed here is a known, counted, expiring exception to "no vendored component file may import a
 * workspace package".
 *
 * The register is empty: every entry it carried was a legacy skill script that gained a `nexus`
 * verb form in epic #247, and story #302 deleted the last of them once no component body named a
 * script path any more. Reaching empty was epic #250's recorded completion condition for this
 * register. It only ever shrinks — an addition is a deliberate reviewed act.
 */
export const COMPONENT_COMPOSITION_WAIVERS: readonly string[] = [];
