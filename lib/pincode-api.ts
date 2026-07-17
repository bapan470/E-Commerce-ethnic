import { getSupabaseBrowser } from './supabase-browser';

export interface PincodeResult {
  serviceable: boolean;
  pincode: string;
  city?: string;
  state?: string;
  etaDays: number;
  codAvailable: boolean;
  message: string;
}

// Rough zone model by the first digit of an Indian PIN code. Used only to
// estimate delivery time when no courier account is wired up yet — swap
// this out for real courier serviceability once Shiprocket/Delhivery etc.
// is integrated.
const ZONE_ETA: Record<string, number> = {
  '1': 3, // Delhi, Haryana, Punjab, HP, J&K
  '2': 4, // UP, Uttarakhand
  '3': 4, // Rajasthan, Gujarat
  '4': 3, // Maharashtra, MP, Chhattisgarh, Goa
  '5': 4, // AP, Telangana, Karnataka
  '6': 4, // Tamil Nadu, Kerala, Puducherry
  '7': 3, // West Bengal, Odisha, NE states
  '8': 5, // Bihar, Jharkhand
  '9': 6, // Army post offices / remote
};

// A handful of known non-serviceable / restricted pincode prefixes
// (remote or COD-restricted areas). Extend as needed from settings.
const COD_RESTRICTED_PREFIXES = ['79', '80'];

export function isValidPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode.trim());
}

/**
 * Checks whether a pincode is serviceable and estimates delivery time.
 * Looks up the city/state from India Post's public pincode API for a
 * friendly confirmation message, then applies a zone-based ETA heuristic.
 */
export async function checkPincodeServiceability(pincode: string): Promise<PincodeResult> {
  const clean = pincode.trim();

  if (!isValidPincode(clean)) {
    return {
      serviceable: false,
      pincode: clean,
      etaDays: 0,
      codAvailable: false,
      message: 'Enter a valid 6-digit pincode',
    };
  }

  const zoneDigit = clean[0];
  const etaDays = ZONE_ETA[zoneDigit] ?? 5;
  const codAvailable = !COD_RESTRICTED_PREFIXES.includes(clean.slice(0, 2));

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`);
    const data = await res.json();
    const record = Array.isArray(data) ? data[0] : null;

    if (record?.Status === 'Success' && record.PostOffice?.length > 0) {
      const office = record.PostOffice[0];
      return {
        serviceable: true,
        pincode: clean,
        city: office.District,
        state: office.State,
        etaDays,
        codAvailable,
        message: `Delivers to ${office.District}, ${office.State} in ${etaDays}-${etaDays + 2} days`,
      };
    }

    return {
      serviceable: false,
      pincode: clean,
      etaDays: 0,
      codAvailable: false,
      message: 'Sorry, we do not deliver to this pincode yet',
    };
  } catch {
    // API unreachable — don't block checkout, fall back to the zone estimate.
    return {
      serviceable: true,
      pincode: clean,
      etaDays,
      codAvailable,
      message: `Estimated delivery in ${etaDays}-${etaDays + 2} days`,
    };
  }
}

export interface ShippingSettings {
  flat_rate: number;
  free_shipping_threshold: number;
}

export async function fetchShippingSettings(): Promise<ShippingSettings> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'shipping')
    .maybeSingle();
  if (error || !data) return { flat_rate: 79, free_shipping_threshold: 1999 };
  return data.value as ShippingSettings;
}
