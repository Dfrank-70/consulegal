"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';


// Interfaccia per i dati utente che ci aspettiamo dall'API
interface AdminUserView {
  id: string;
  name: string | null;
  email: string | null;
  role: string; // Role from API will be a string
  isBlocked: boolean;
  createdAt: string;
  subscription: {
    id: string;
    plan: string; // O un enum più specifico se definito
    status: string;
    tokenLimit: number;
    createdAt: string;
  } | null;
  _count: {
    conversations: number;
  };
}

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === "ADMIN") {
      const fetchUsers = async () => {
        setIsLoading(true);
        try {
          const response = await fetch('/api/admin/users');
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore ${response.status} nel recuperare gli utenti`);
          }
          const data = await response.json();
          setUsers(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchUsers();
    }
  }, [session, status]);

  if (status === 'loading' || isLoading) {
    return <div className="p-4"><p>Caricamento in corso...</p></div>;
  }

  if (status === 'unauthenticated' || (status === 'authenticated' && session?.user?.role !== "ADMIN")) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-semibold text-red-600">Accesso Negato</h1>
        <p>Questa sezione è riservata agli amministratori.</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500"><p>Errore: {error}</p></div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Gestione Utenti</h1>
      
      {users.length === 0 ? (
        <p>Nessun utente trovato.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 border-b text-left">Nome</th>
                <th className="py-2 px-4 border-b text-left">Email</th>
                <th className="py-2 px-4 border-b text-left">Ruolo</th>
                <th className="py-2 px-4 border-b text-left">Limite Token</th>
                <th className="py-2 px-4 border-b text-left">Stato Abbon.</th>
                <th className="py-2 px-4 border-b text-left">Bloccato</th>
                <th className="py-2 px-4 border-b text-left">Creato il</th>
                <th className="py-2 px-4 border-b text-left">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{user.name || 'N/A'}</td>
                  <td className="py-2 px-4 border-b">{user.email || 'N/A'}</td>
                  <td className="py-2 px-4 border-b">{user.role}</td>
                  <td className="py-2 px-4 border-b">
                    {user.subscription ? user.subscription.tokenLimit.toLocaleString('it-IT') : 'N/A'}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {user.subscription ? user.subscription.status : 'Nessuno'}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {user.isBlocked ? <span className='text-red-500'>Sì</span> : 'No'}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {new Date(user.createdAt).toLocaleDateString('it-IT')}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {/* Qui inseriremo i controlli per modificare il tokenLimit */}
                    <button 
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm"
                      onClick={() => alert(`Modifica utente ${user.id} (da implementare)`)}
                    >
                      Modifica
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
