'use server';

import { signOut } from '../../auth';
import { headers } from 'next/headers';

export async function logout() {
  // Ottieni l'host corrente dalle intestazioni della richiesta
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  
  // Costruisci l'URL di redirect utilizzando l'host corrente
  const redirectUrl = `http://${host}/`;
  
  await signOut({ redirectTo: redirectUrl });
}
