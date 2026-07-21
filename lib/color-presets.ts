/**
 * Ready-made colour library for the "Add colour variant" picker in admin.
 * Covers the shades most commonly used for sarees/ethnic wear so the admin
 * can just click a swatch instead of typing the same colour names (and
 * matching hex codes) for every product. "Custom" lets them type a colour
 * that isn't in the list and pick its own hex value.
 */
export interface ColorPreset {
  name: string;
  hex: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'Red', hex: '#C1121F' },
  { name: 'Maroon', hex: '#6D071A' },
  { name: 'Wine', hex: '#5E1B33' },
  { name: 'Pink', hex: '#E75480' },
  { name: 'Rani Pink', hex: '#D6006D' },
  { name: 'Peach', hex: '#FFCBA4' },
  { name: 'Orange', hex: '#E8641C' },
  { name: 'Rust', hex: '#B7410E' },
  { name: 'Mustard', hex: '#D4A017' },
  { name: 'Yellow', hex: '#F4C430' },
  { name: 'Gold', hex: '#C9A227' },
  { name: 'Beige', hex: '#E8DCC8' },
  { name: 'Cream', hex: '#F5EEDC' },
  { name: 'Off White', hex: '#F6F1E9' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Green', hex: '#1E7B45' },
  { name: 'Bottle Green', hex: '#0B3D2E' },
  { name: 'Olive', hex: '#5C5B29' },
  { name: 'Mint', hex: '#A8DDCB' },
  { name: 'Teal', hex: '#146B6B' },
  { name: 'Turquoise', hex: '#30BFBF' },
  { name: 'Blue', hex: '#1A4F8B' },
  { name: 'Navy Blue', hex: '#0B1F3A' },
  { name: 'Sky Blue', hex: '#87CEEB' },
  { name: 'Purple', hex: '#6A2E8C' },
  { name: 'Lavender', hex: '#B497D6' },
  { name: 'Magenta', hex: '#BE1B7A' },
  { name: 'Grey', hex: '#8C8C8C' },
  { name: 'Black', hex: '#111111' },
  { name: 'Brown', hex: '#6B4226' },
  { name: 'Tan', hex: '#C8A165' },
  { name: 'Copper', hex: '#B5652E' },
  { name: 'Coral', hex: '#FF6F5E' },
  { name: 'Multicolour', hex: '#A855F7' },
];

/** Case-insensitive lookup, used to pre-fill the hex swatch when an admin
 *  types a colour name that matches a preset instead of clicking it. */
export function findPresetByName(name: string): ColorPreset | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return COLOR_PRESETS.find((c) => c.name.toLowerCase() === needle);
}
