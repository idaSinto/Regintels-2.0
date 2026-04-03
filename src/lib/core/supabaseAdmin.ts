import { createClient } from '@supabase/supabase-js';

import { supabaseAnonKey, supabaseUrl } from './supabaseAuthConfig';

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

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

function isSupabaseDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as SupabaseErrorLike;
  const message = candidate.message?.toLowerCase() ?? '';

  return (
    candidate.code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('already registered') ||
    message.includes('user already registered') ||
    message.includes('has already been registered')
  );
}

function normalizeCreateStaffAuthError(error: unknown): Error {
  if (isSupabaseDuplicateError(error)) {
    return new Error('This email is already registered. Please sign in instead.');
  }

  return error instanceof Error ? error : new Error('Failed to create auth user.');
}

function normalizeCreateStaffRowError(error: unknown): Error {
  const message = getErrorMessage(error).toLowerCase();

  if (isSupabaseDuplicateError(error)) {
    if (message.includes(staffIdColumn.toLowerCase()) || message.includes('staff_id')) {
      return new Error('This staff ID is already in use.');
    }

    if (message.includes(staffEmailColumn.toLowerCase()) || message.includes('email')) {
      return new Error('This email is already linked to an existing account.');
    }
  }

  return error instanceof Error ? error : new Error('Failed to create staff account.');
}

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

function mapStaffAccountRow(row: StaffAccountRow | null): StaffAccountRecord | null {
  if (!row) {
    return null;
  }

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
    .map(row => mapStaffAccountRow(row))
    .filter((row): row is StaffAccountRecord => row !== null);
}

export async function findStaffAccountByEmail(email: string): Promise<StaffAccountRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from(staffTable)
    .select('*')
    .eq(staffEmailColumn, normalizedEmail)
    .maybeSingle<StaffAccountRow>();

  if (error) {
    throw error;
  }

  return mapStaffAccountRow(data);
}

export async function findStaffAccountByStaffId(staffId: string): Promise<StaffAccountRecord | null> {
  const normalizedStaffId = staffId.trim();

  if (!normalizedStaffId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from(staffTable)
    .select('*')
    .eq(staffIdColumn, normalizedStaffId)
    .maybeSingle<StaffAccountRow>();

  if (error) {
    throw error;
  }

  return mapStaffAccountRow(data);
}

export async function verifyStaffPassword(email: string, password: string): Promise<boolean> {
  const verificationClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await verificationClient.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  return !error;
}

export async function createStaffAccount(params: {
  staffId: string;
  email: string;
  password: string;
}) {
  const normalizedStaffId = params.staffId.trim();
  const normalizedEmail = params.email.trim().toLowerCase();

  const existingStaffByEmail = await findStaffAccountByEmail(normalizedEmail);
  if (existingStaffByEmail) {
    throw new Error('This email is already linked to an existing account.');
  }

  const existingStaffById = await findStaffAccountByStaffId(normalizedStaffId);
  if (existingStaffById) {
    throw new Error('This staff ID is already in use.');
  }

  const { data: createdAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: params.password,
    email_confirm: true,
  });

  if (authError) {
    throw normalizeCreateStaffAuthError(authError);
  }

  const authUserId = createdAuthUser.user?.id;

  try {
    return await insertStaffAccountRow({
      staffId: normalizedStaffId,
      email: normalizedEmail,
    });
  } catch (error) {
    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
    }

    throw normalizeCreateStaffRowError(error);
  }
}

export async function signUpStaffAccount(params: {
  staffId: string;
  email: string;
  password: string;
}) {
  return createStaffAccount(params);
}

export async function insertStaffAccountRow(params: {
  staffId: string;
  email: string;
}) {
  const normalizedStaffId = params.staffId.trim();
  const normalizedEmail = params.email.trim().toLowerCase();

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

export async function updateStaffAccountByEmail(
  email: string,
  params: {
    staffId?: string;
    email?: string;
    password?: string;
    isActive?: boolean;
  },
) {
  const record = await findStaffAccountByEmail(email);

  if (!record) {
    throw new Error('Staff account not found.');
  }

  return updateStaffAccount(record.id, params);
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

export async function deleteStaffAccountByEmail(email: string) {
  const record = await findStaffAccountByEmail(email);

  if (!record) {
    throw new Error('Staff account not found.');
  }

  await deleteStaffAccount(record.id);
}
