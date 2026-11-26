
import 'dotenv/config';
import pg from 'pg';
import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';

const { Client } = pg;

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName =
    process.env.ADMIN_FULL_NAME?.trim() ||
    'Rekolta Administrator';

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be provided.',
    );
  }

  if (
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('A valid administrator email is required.');
  }

  if (
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new Error(
      'Password must contain at least 12 characters and no more than 72 UTF-8 bytes.',
    );
  }

  if (fullName.length > 150) {
    throw new Error(
      'Full name cannot exceed 150 characters.',
    );
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );

    if (existingUser.rowCount > 0) {
      throw new Error(
        'An account with this email already exists.',
      );
    }

    const passwordHash = await hash(password, 12);

    const result = await client.query(
      `
      INSERT INTO users (
        id,
        email,
        password_hash,
        role,
        full_name,
        is_blocked,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
      RETURNING id, email, full_name, role, is_blocked
      `,
      [
        randomUUID(),
        email,
        passwordHash,
        'ADMIN',
        fullName,
      ],
    );

    console.log(
      'Administrator account created successfully.',
    );

    console.table(result.rows);
  } finally {
    await client.end();
  }
}

createAdmin().catch((error) => {
  console.error(
    'Administrator creation failed:',
    error.message,
  );

  process.exitCode = 1;
});
