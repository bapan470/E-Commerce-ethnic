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
  name: 'Aruhi Handlooms',
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

export type EmailProvider = 'resend' | 'zeptomail' | '';

export interface EmailSettings {
  provider: EmailProvider;
  api_key: string;
  sender_email: string;
  sender_name: string;
  // ZeptoMail is hosted regionally — India (.in) vs global (.com) accounts
  // use different API base URLs. Ignored by Resend.
  zeptomail_region: 'in' | 'com';
}

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  provider: '',
  api_key: '',
  sender_email: '',
  sender_name: 'Aruhi Handlooms',
  zeptomail_region: 'in',
};

export async function fetchEmailSettings(): Promise<EmailSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'email_provider')
    .maybeSingle();
  if (error || !data) return DEFAULT_EMAIL_SETTINGS;
  return { ...DEFAULT_EMAIL_SETTINGS, ...(data.value as Partial<EmailSettings>) };
}

export async function saveEmailSettings(settings: EmailSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'email_provider', value: settings }, { onConflict: 'key' });
  if (error) throw error;
}
