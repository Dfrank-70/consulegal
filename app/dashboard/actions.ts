'use server';

import { signOut } from '../../auth';
import { headers } from 'next/headers';

export async function logout() {
  await signOut({ redirectTo: '/login' });
}
