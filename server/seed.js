import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { initSchema } from './schema.js';
import { get, run } from './db.js';
import { getWebmailUrl } from './emailProviderService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const credentialsPath = path.join(__dirname, '..', 'initial-credentials.local.txt');

const seedUsers = [
  ['altanzul', 'B. Altanzul', 'member', 'altanzul@idea.org.mn', 'SEED_PASSWORD_ALTANZUL'],
  ['enkhbold', 'Enkhbold', 'member', 'enkhbold@idea.org.mn', 'SEED_PASSWORD_ENKHBOLD'],
  ['khulan', 'G. Khulan', 'member', 'khulan@idea.org.mn', 'SEED_PASSWORD_KHULAN'],
  ['jamsrandorj', 'J. Jamsrandorj', 'member', 'jamsrandorj@idea.org.mn', 'SEED_PASSWORD_JAMSRANDORJ'],
  ['munkhsolongo', 'Munkhsolongo', 'member', 'munkhsolongo@idea.org.mn', 'SEED_PASSWORD_MUNKHSOLONGO'],
  ['lkhagvasuren', 'Lkhagvasuren', 'member', 'lkhagvasuren@idea.org.mn', 'SEED_PASSWORD_LKHAGVASUREN'],
  ['tsedendorj', 'Tsedendorj', 'member', 'tsedendorj@idea.org.mn', 'SEED_PASSWORD_TSEDENDORJ'],
  ['admin', 'IDEA Administrator', 'admin', 'admin@idea.org.mn', 'SEED_PASSWORD_ADMIN'],
];

function temporaryPassword() {
  return crypto.randomBytes(18).toString('base64url');
}

await initSchema();

const generated = [];

for (const [username, displayName, role, email, envName] of seedUsers) {
  const existing = await get('SELECT id FROM users WHERE username = ? OR login_email = ?', [username, email]);
  if (existing) continue;

  const password = process.env[envName] || temporaryPassword();
  if (!process.env[envName]) {
    generated.push(`${username}: ${password}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await run(
    `INSERT INTO users (username, login_email, password_hash, role, display_name, active, force_password_change)
     VALUES (?, ?, ?, ?, ?, 1, 1)`,
    [username, email, passwordHash, role, displayName],
  );

  await run('INSERT INTO member_profiles (user_id, organization, visibility) VALUES (?, ?, ?)', [
    result.id,
    'IDEA',
    'members_only',
  ]);

  await run(
    `INSERT INTO email_accounts (user_id, email_address, provider, webmail_url, status, notes)
     VALUES (?, ?, 'manual', ?, 'pending_setup', ?)`,
    [result.id, email, getWebmailUrl(), 'Mailbox must be provisioned manually with the selected email provider.'],
  );
}

if (generated.length > 0) {
  const content = [
    'IDEA initial generated credentials',
    'Keep this file private. Do not upload it to public_html.',
    `Generated at: ${new Date().toISOString()}`,
    '',
    ...generated,
    '',
  ].join('\n');
  fs.writeFileSync(credentialsPath, content, { mode: 0o600 });
  console.log(`Generated temporary passwords saved to ${credentialsPath}`);
}

await run(
  `INSERT OR IGNORE INTO research_partnerships
   (id, title_en, title_mn, description_en, description_mn, category, country, status, visibility)
   VALUES
   (1, 'International Research Cooperation', 'Олон улсын судалгааны хамтын ажиллагаа',
    'Member-only cooperation concepts and outreach notes for international research.',
    'Олон улсын судалгааны хамтын ажиллагааны санаачилга, харилцааны тэмдэглэл.',
    'international', 'global', 'active', 'members_only'),
   (2, 'AI Policy and Governance Projects', 'Хиймэл оюуны бодлого, засаглалын төслүүд',
    'Potential project concepts related to responsible AI governance and regulation.',
    'Хариуцлагатай хиймэл оюуны засаглал, зохицуулалтын төслийн боломжит санаачилгууд.',
    'policy', 'mongolia', 'active', 'members_only')`,
);

console.log('Seed completed.');
process.exit(0);
