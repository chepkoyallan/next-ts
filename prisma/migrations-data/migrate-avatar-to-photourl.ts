/**
 * Data Migration: Avatar to PhotoURL
 * Copies avatar field data to photoURL where photoURL is null
 * Run this before removing the avatar field from schema
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Load environment variables - try .env first, then .env.development
const envPath = resolve(process.cwd(), '.env');
const envDevPath = resolve(process.cwd(), '.env.development');

if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('Loaded .env');
} else if (existsSync(envDevPath)) {
  config({ path: envDevPath });
  console.log('Loaded .env.development');
} else {
  console.warn('No .env or .env.development file found. Using system environment variables.');
}

const prisma = new PrismaClient();

async function migrateAvatarToPhotoURL() {
  console.log('Starting avatar � photoURL migration...');

  try {
    // Find users with avatar but no photoURL
    const usersToMigrate = await prisma.user.findMany({
      where: {
        photoURL: {
          not: null,
        },
      },
      select: {
        id: true,
        email: true,
        photoURL: true,
      },
    });

    console.log(`Found ${usersToMigrate.length} users to migrate`);

    if (usersToMigrate.length === 0) {
      console.log('No users need migration. All done!');
      return;
    }

    // Migrate each user
    let successCount = 0;
    let errorCount = 0;

    for (const user of usersToMigrate) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            photoURL: user.photoURL,
          },
        });
        console.log(` Migrated user ${user.email}: ${user.photoURL} � photoURL`);
        successCount++;
      } catch (error) {
        console.error(` Failed to migrate user ${user.email}:`, error);
        errorCount++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total users found: ${usersToMigrate.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log('========================\n');

    if (errorCount === 0) {
      console.log(' Migration completed successfully!');
      console.log('You can now safely remove the avatar field from schema.prisma');
    } else {
      console.log('� Migration completed with errors. Please review failed users.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateAvatarToPhotoURL()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
