import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from './supabaseAuthConfig';

function requireServiceKey(): string {
  const value = process.env.SUPABASE_SERVICE_KEY;

  if (!value) {
    throw new Error('SUPABASE_SERVICE_KEY is missing');
  }

  return value;
}

const supabaseServiceKey: string = requireServiceKey();

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const staffTable = process.env.SUPABASE_STAFF_TABLE ?? 'staff_accounts';
export const staffIdColumn = process.env.SUPABASE_STAFF_ID_COLUMN ?? 'staff_id';
export const staffEmailColumn = process.env.SUPABASE_STAFF_EMAIL_COLUMN ?? 'email';
export const staffActiveColumn = process.env.SUPABASE_STAFF_ACTIVE_COLUMN ?? 'is_active';

export type StaffLoginIdentity = {
  email: string;
  staffId: string;
};

export type StaffAccountRecord = {
  id: number;
  staffId: string;
  email: string;
  isActive: boolean;
};

type StaffAccountRow = {
  id: number;
  [key: string]: unknown;
};

type AuthUserSummary = {
  id: string;
  email: string;
};

async function findAuthUserByEmail(email: string): Promise<AuthUserSummary | null> {
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const users = data.users ?? [];
    const match = users.find(user => user.email?.toLowerCase() === email.toLowerCase());

    if (match?.id && match.email) {
      return {
        id: match.id,
        email: match.email,
      };
    }

    if (users.length < 200) {
      return null;
    }

    page += 1;
  }
}

export async function findStaffLoginIdentity(staffId: string): Promise<StaffLoginIdentity | null> {
  const normalizedStaffId = staffId.trim();

  if (!normalizedStaffId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from(staffTable)
    .select('*')
    .eq(staffIdColumn, normalizedStaffId)
    .eq(staffActiveColumn, true)
    .maybeSingle<StaffAccountRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const email = data[staffEmailColumn];
  const resolvedStaffId = data[staffIdColumn];

  if (typeof email !== 'string' || typeof resolvedStaffId !== 'string') {
    return null;
  }

  return {
    email,
    staffId: resolvedStaffId,
  };
}

export async function listStaffAccounts(): Promise<StaffAccountRecord[]> {
  const { data, error } = await supabaseAdmin
    .from(staffTable)
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map(row => {
      const id = row.id;
      const staffId = row[staffIdColumn];
      const email = row[staffEmailColumn];
      const isActive = row[staffActiveColumn];

      if (
        typeof id !== 'number' ||
        typeof staffId !== 'string' ||
        typeof email !== 'string' ||
        typeof isActive !== 'boolean'
      ) {
        return null;
      }

      return {
        id,
        staffId,
        email,
        isActive,
      };
    })
    .filter((row): row is StaffAccountRecord => row !== null);
}

export async function createStaffAccount(params: {
  staffId: string;
  email: string;
  password: string;
}) {
  const normalizedStaffId = params.staffId.trim();
  const normalizedEmail = params.email.trim().toLowerCase();

  const { data: createdAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: params.password,
    email_confirm: true,
  });

  if (authError) {
    throw authError;
  }

  const authUserId = createdAuthUser.user?.id;

  try {
    const { data, error } = await supabaseAdmin
      .from(staffTable)
      .insert([
        {
          [staffIdColumn]: normalizedStaffId,
          [staffEmailColumn]: normalizedEmail,
          [staffActiveColumn]: true,
        },
      ])
      .select('*')
      .single<StaffAccountRow>();

    if (error) {
      throw error;
    }

    return {
      id: data.id as number,
      staffId: data[staffIdColumn] as string,
      email: data[staffEmailColumn] as string,
      isActive: data[staffActiveColumn] as boolean,
    } satisfies StaffAccountRecord;
  } catch (error) {
    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
    }

    throw error;
  }
}

export async function updateStaffAccount(
  id: number,
  params: {
    staffId?: string;
    email?: string;
    password?: string;
    isActive?: boolean;
  },
) {
  const { data: existingRow, error: existingError } = await supabaseAdmin
    .from(staffTable)
    .select('*')
    .eq('id', id)
    .maybeSingle<StaffAccountRow>();

  if (existingError) {
    throw existingError;
  }

  if (!existingRow) {
    throw new Error('Staff account not found.');
  }

  const currentEmail = existingRow[staffEmailColumn];
  if (typeof currentEmail !== 'string') {
    throw new Error('Staff account email is invalid.');
  }

  const nextStaffId = params.staffId?.trim() || (existingRow[staffIdColumn] as string);
  const nextEmail = params.email?.trim().toLowerCase() || currentEmail;
  const nextIsActive =
    typeof params.isActive === 'boolean'
      ? params.isActive
      : (existingRow[staffActiveColumn] as boolean);

  const authUser = await findAuthUserByEmail(currentEmail);

  if ((params.email || params.password) && !authUser) {
    throw new Error('Related auth user was not found.');
  }

  if (authUser) {
    const updatePayload: { email?: string; password?: string } = {};

    if (params.email) {
      updatePayload.email = nextEmail;
    }

    if (params.password) {
      updatePayload.password = params.password;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        updatePayload,
      );

      if (authError) {
        throw authError;
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from(staffTable)
    .update({
      [staffIdColumn]: nextStaffId,
      [staffEmailColumn]: nextEmail,
      [staffActiveColumn]: nextIsActive,
    })
    .eq('id', id)
    .select('*')
    .single<StaffAccountRow>();

  if (error) {
    throw error;
  }

  return {
    id: data.id as number,
    staffId: data[staffIdColumn] as string,
    email: data[staffEmailColumn] as string,
    isActive: data[staffActiveColumn] as boolean,
  } satisfies StaffAccountRecord;
}

export async function deleteStaffAccount(id: number) {
  const { data: existingRow, error: existingError } = await supabaseAdmin
    .from(staffTable)
    .select('*')
    .eq('id', id)
    .maybeSingle<StaffAccountRow>();

  if (existingError) {
    throw existingError;
  }

  if (!existingRow) {
    throw new Error('Staff account not found.');
  }

  const email = existingRow[staffEmailColumn];
  if (typeof email !== 'string') {
    throw new Error('Staff account email is invalid.');
  }

  const authUser = await findAuthUserByEmail(email);

  const { error } = await supabaseAdmin.from(staffTable).delete().eq('id', id);
  if (error) {
    throw error;
  }

  if (authUser) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    if (authError) {
      throw authError;
    }
  }
}
