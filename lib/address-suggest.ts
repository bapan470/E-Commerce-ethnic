/**
 * Free address autosuggest for the "Street address" field.
 *
 * Uses OpenStreetMap's public Nominatim search API — no API key, no cost,
 * no signup. Results are restricted to India (countrycodes=in) since that's
 * the only country this storefront ships to right now.
 *
 * Nominatim's usage policy asks for max ~1 request/second and a descriptive
 * referer, which the debounce in useAddressSuggestions() + browser-sent
 * Referer header already satisfy for a storefront of this size. If this
 * ever needs to scale up a lot, swap the endpoint below for a paid
 * provider (Google Places, Mapbox, etc.) without changing any callers.
 */

export interface AddressSuggestion {
  /** Full label shown in the suggestion dropdown */
  label: string;
  /** Best-guess first line (house/road/neighbourhood) to put in Street address */
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

interface NominatimResult {
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    quarter?: string;
    city?: string;
    town?: string;
    village?: string;
    city_district?: string;
    state?: string;
    postcode?: string;
  };
}

function buildLine1(addr: NominatimResult['address']): string {
  if (!addr) return '';
  const parts = [addr.house_number, addr.road || addr.neighbourhood || addr.quarter].filter(
    Boolean
  );
  return parts.join(', ');
}

/**
 * Looks up address suggestions for free-text typed into the Street address
 * field. Returns [] on any error or for very short queries — callers should
 * treat that as "no suggestions available" rather than a hard failure, so
 * checkout never gets blocked by this being down.
 */
export async function fetchAddressSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 4) return [];

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'in');
    url.searchParams.set('limit', '5');

    const res = await fetch(url.toString(), { signal });
    if (!res.ok) return [];
    const data: NominatimResult[] = await res.json();

    return data
      .map((r) => {
        const addr = r.address;
        const city = addr?.city || addr?.town || addr?.village || addr?.city_district || '';
        const line1 = buildLine1(addr) || r.display_name.split(',')[0];
        return {
          label: r.display_name,
          line1,
          city,
          state: addr?.state || '',
          pincode: addr?.postcode || '',
        };
      })
      .filter((s) => s.line1);
  } catch {
    // Aborted or network/API issue — just show no suggestions.
    return [];
  }
}
