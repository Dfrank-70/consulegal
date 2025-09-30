import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  console.log('🚀 Creazione utente admin...');

  const adminEmail = 'admin@consulegal.it';
  const adminPassword = 'password123';

  try {
    // Verifica se l'utente admin esiste già
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log(`✅ L'utente admin ${adminEmail} esiste già.`);
      return;
    }

    // Hash della password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Crea il nuovo utente admin
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        role: Role.ADMIN,
        name: 'Admin',
      },
    });

    console.log('🎉 Utente admin creato con successo!');
    console.log(`   - Email: ${adminUser.email}`);
    console.log(`   - Password: ${adminPassword}`);
    console.log('\nOra puoi accedere al pannello admin su /admin con queste credenziali.');

  } catch (error) {
    console.error('Errore durante la creazione dell utente admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
