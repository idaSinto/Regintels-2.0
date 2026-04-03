import { redirect } from 'next/navigation';

import ProfileSettingsClient from '@/components/account/ProfileSettingsClient';
import { findStaffAccountByEmail } from '@/lib/core/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/core/supabaseServer';

export default async function StaffUsersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/');
  }

  const account = await findStaffAccountByEmail(user.email);

  if (!account) {
    redirect('/');
  }

  return <ProfileSettingsClient initialAccount={account} />;
}
