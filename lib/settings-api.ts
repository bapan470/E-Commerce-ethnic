import { supabase } from './supabase';

export interface StoreInfo {
  name: string;
  address: string;
  gstin: string;
  support_email: string;
  support_phone: string;
  whatsapp_number?: string;
}

const DEFAULT_STORE_INFO: StoreInfo = {
  name: 'Saaj Boutique',
  address: '',
  gstin: '',
  support_email: '',
  support_phone: '',
  whatsapp_number: '',
};

export async function fetchStoreInfo(): Promise<StoreInfo> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'store_info')
    .maybeSingle();
  if (error || !data) return DEFAULT_STORE_INFO;
  return { ...DEFAULT_STORE_INFO, ...(data.value as Partial<StoreInfo>) };
}

export async function saveStoreInfo(info: StoreInfo) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'store_info', value: info }, { onConflict: 'key' });
  if (error) throw error;
}
