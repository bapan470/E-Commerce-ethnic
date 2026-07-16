import { getServerSupabase } from './supabase-server';

export async function fetchOrders() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(id: string, status: string) {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
  return data;
}
