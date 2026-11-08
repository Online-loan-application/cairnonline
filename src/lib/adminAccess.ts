import { supabase } from './supabase'

export async function getDashboardPath(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data ? '/admin' : '/dashboard'
}
