/**
 * CF flags of a variable (`flag_values` / `flag_masks` / `flag_meanings`), as
 * sent by the backend in File Information (`FlagSpec.to_json()` in
 * python/sdv_backend/flags.py). Values and masks are strings: a uint64 mask
 * does not fit in a JavaScript number.
 */

export type FlagKind = 'values' | 'masks' | 'mixed';

export interface FlagInfo {
    meaning: string;
    /** `flag_values` entry */
    value: string | null;
    /** `flag_masks` entry */
    mask: string | null;
    /** Bits of the mask: `bit 3`, `bits 2-3` */
    bits: string | null;
    /** `flag_colors` entry (hex or color name, checked by the backend) */
    color: string | null;
}

export interface FlagsInfo {
    kind: FlagKind;
    flags: FlagInfo[];
    /** `flag_colors` when the file has a valid one */
    colors_source: 'flag_colors' | null;
    /** Why the flags cannot be used (plots then show plain numbers) */
    problems: string[];
    /** Information, e.g. `flag_colors` ignored */
    notes: string[];
}

/** CSS colors accepted from `flag_colors` (same rule as the backend). */
const FLAG_COLOR_RE =
    /^(#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|[a-zA-Z]+)$/;

export function isSafeFlagColor(color: string | null): color is string {
    return color !== null && FLAG_COLOR_RE.test(color);
}
