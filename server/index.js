import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { initSchema } from './schema.js';
import { all, get, run } from './db.js';
import { getWebmailUrl } from './emailProviderService.js';
import { browserFamily, deviceType, hashIp, publicUser, signSession, verifySession } from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const app = express();
const port = Number(process.env.PORT || 3000);

await initSchema();

app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
});

function cleanString(value, max = 5000) {
  return String(value ?? '').trim().slice(0, max);
}

function required(value) {
  return cleanString(value).length > 0;
}

function temporaryPassword() {
  return crypto.randomBytes(18).toString('base64url');
}

function safeEmailUsername(value) {
  return cleanString(value, 80).toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

function saveGeneratedCredential(username, password, reason) {
  const file = path.join(rootDir, 'initial-credentials.local.txt');
  const line = `${new Date().toISOString()} ${reason} ${username}: ${password}\n`;
  fs.appendFileSync(file, line, { mode: 0o600 });
}

async function audit(req, action, targetUserId = null) {
  await run('INSERT INTO audit_logs (user_id, action, target_user_id, ip_hash) VALUES (?, ?, ?, ?)', [
    req.user?.id || null,
    action,
    targetUserId,
    hashIp(req),
  ]);
}

async function auth(req, res, next) {
  try {
    const token = req.cookies.idea_session;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const payload = verifySession(token);
    const user = await get('SELECT * FROM users WHERE id = ? AND active = 1', [payload.id]);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = publicUser(user);
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

function sessionCookie(res, token) {
  res.cookie('idea_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

async function canAccessProject(user, projectId) {
  if (user.role === 'admin') return true;
  const project = await get(
    `SELECT p.* FROM research_projects p
     LEFT JOIN research_project_members m ON m.project_id = p.id AND m.user_id = ? AND m.active = 1
     WHERE p.id = ? AND (p.created_by = ? OR p.project_lead_id = ? OR m.id IS NOT NULL OR p.visibility = 'members_only')`,
    [user.id, projectId, user.id, user.id],
  );
  return Boolean(project);
}

async function canManageProject(user, projectId) {
  if (user.role === 'admin') return true;
  const project = await get('SELECT id FROM research_projects WHERE id = ? AND (created_by = ? OR project_lead_id = ?)', [
    projectId,
    user.id,
    user.id,
  ]);
  return Boolean(project);
}

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const identifier = cleanString(req.body.identifier || req.body.username || req.body.login_email, 180).toLowerCase();
  const password = String(req.body.password || '');
  const expectedRole = cleanString(req.body.role, 30);

  if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials' });

  const user = await get('SELECT * FROM users WHERE active = 1 AND (lower(username) = ? OR lower(login_email) = ?)', [
    identifier,
    identifier,
  ]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (expectedRole === 'admin' && user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  if (expectedRole === 'member' && user.role === 'admin') return res.status(403).json({ error: 'Use admin login' });

  await run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  const updated = await get('SELECT * FROM users WHERE id = ?', [user.id]);
  sessionCookie(res, signSession(updated));
  req.user = publicUser(updated);
  await audit(req, 'auth.login', updated.id);
  return res.json({ user: publicUser(updated) });
});

app.post('/api/auth/logout', auth, async (req, res) => {
  await audit(req, 'auth.logout', req.user.id);
  res.clearCookie('idea_session');
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

app.post('/api/auth/change-password', auth, async (req, res) => {
  const password = String(req.body.password || '');
  if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });
  const passwordHash = await bcrypt.hash(password, 12);
  await run('UPDATE users SET password_hash = ?, force_password_change = 0 WHERE id = ?', [passwordHash, req.user.id]);
  const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  sessionCookie(res, signSession(user));
  await audit(req, 'auth.change_password', req.user.id);
  res.json({ user: publicUser(user) });
});

app.post('/api/track', async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  await run(
    `INSERT INTO visits
     (path, page_title, language, referrer, utm_source, utm_medium, utm_campaign, browser, device_type, ip_hash, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cleanString(req.body.path, 300) || '/',
      cleanString(req.body.page_title, 300),
      cleanString(req.body.language, 5).toUpperCase() || 'EN',
      cleanString(req.body.referrer, 500),
      cleanString(req.body.utm_source, 120),
      cleanString(req.body.utm_medium, 120),
      cleanString(req.body.utm_campaign, 120),
      browserFamily(ua),
      deviceType(ua),
      hashIp(req),
      cleanString(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '', 80),
    ],
  );
  res.json({ ok: true });
});

app.post('/api/membership/apply', applyLimiter, async (req, res) => {
  const requiredFields = [
    'full_name',
    'email',
    'phone',
    'organization',
    'position',
    'research_interests',
    'reason_for_joining',
    'requested_email_username',
  ];
  if (!requiredFields.every((field) => required(req.body[field]))) {
    return res.status(400).json({ error: 'Required fields are missing.' });
  }
  if (!req.body.consent_accuracy || !req.body.consent_approval) {
    return res.status(400).json({ error: 'Consent is required.' });
  }

  const requestedUsername = safeEmailUsername(req.body.requested_email_username);
  const requestedEmail = `${requestedUsername}@idea.org.mn`;
  if (!requestedUsername || !requestedEmail.endsWith('@idea.org.mn')) {
    return res.status(400).json({ error: 'Requested IDEA email is invalid.' });
  }

  // TODO: Add protected membership application file upload when cPanel storage paths are finalized.
  // Uploaded files must be stored outside public_html, validated by type/size, and served only to authenticated admins.
  const result = await run(
    `INSERT INTO membership_applications
     (full_name, email, phone, organization, position, research_interests, reason_for_joining,
      requested_email_username, requested_idea_email, short_bio, expertise_area, professional_profile_url,
      supporting_document_path, supporting_document_original_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      cleanString(req.body.full_name, 180),
      cleanString(req.body.email, 180).toLowerCase(),
      cleanString(req.body.phone, 80),
      cleanString(req.body.organization, 180),
      cleanString(req.body.position, 180),
      cleanString(req.body.research_interests, 2000),
      cleanString(req.body.reason_for_joining, 2000),
      requestedUsername,
      requestedEmail,
      cleanString(req.body.short_bio, 2000),
      cleanString(req.body.expertise_area, 300),
      cleanString(req.body.professional_profile_url, 600),
      cleanString(req.body.supporting_document_path, 800),
      '',
    ],
  );

  await run('INSERT INTO audit_logs (action, ip_hash) VALUES (?, ?)', [
    'membership_application_submitted',
    hashIp(req),
  ]);
  res.json({ id: result.id, requested_idea_email: requestedEmail });
});

app.get('/api/member/dashboard', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  const projects = await all(
    `SELECT p.* FROM research_projects p
     LEFT JOIN research_project_members m ON m.project_id = p.id AND m.user_id = ? AND m.active = 1
     WHERE p.created_by = ? OR p.project_lead_id = ? OR m.id IS NOT NULL OR p.visibility = 'members_only'
     ORDER BY p.updated_at DESC LIMIT 8`,
    [req.user.id, req.user.id, req.user.id],
  );
  const profile = await get('SELECT * FROM member_profiles WHERE user_id = ?', [req.user.id]);
  const email = await get('SELECT * FROM email_accounts WHERE user_id = ?', [req.user.id]);
  res.json({ user: req.user, profile, email, projects });
});

app.get('/api/member/profile', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  const profile = await get('SELECT * FROM member_profiles WHERE user_id = ?', [req.user.id]);
  res.json({ profile });
});

app.put('/api/member/profile', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  const visibility = ['private', 'members_only', 'public'].includes(req.body.visibility) ? req.body.visibility : 'members_only';
  await run(
    `UPDATE member_profiles
     SET position = ?, organization = ?, phone = ?, bio = ?, photo_url = ?, visibility = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [
      cleanString(req.body.position, 200),
      cleanString(req.body.organization, 200),
      cleanString(req.body.phone, 80),
      cleanString(req.body.bio, 2000),
      cleanString(req.body.photo_url, 500),
      visibility,
      req.user.id,
    ],
  );
  await audit(req, 'member.profile.update', req.user.id);
  res.json({ profile: await get('SELECT * FROM member_profiles WHERE user_id = ?', [req.user.id]) });
});

app.get('/api/member/email', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  const email = await get('SELECT * FROM email_accounts WHERE user_id = ?', [req.user.id]);
  res.json({ email, webmail_url: getWebmailUrl(), provider_mode: process.env.EMAIL_PROVIDER_MODE || 'manual' });
});

app.get('/api/member/research-partnerships', auth, requireRole(['member', 'project_lead', 'admin']), async (_req, res) => {
  const items = await all('SELECT * FROM research_partnerships ORDER BY created_at DESC');
  res.json({ items });
});

app.get('/api/member/member-profiles', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  const rows = await all(
    `SELECT u.id, u.display_name, u.login_email, e.email_address, p.position, p.organization, p.bio, p.photo_url, p.visibility,
            CASE WHEN p.visibility = 'public' THEN p.phone WHEN u.id = ? THEN p.phone ELSE '' END AS phone
     FROM users u
     JOIN member_profiles p ON p.user_id = u.id
     LEFT JOIN email_accounts e ON e.user_id = u.id
     WHERE u.active = 1 AND (p.visibility IN ('members_only','public') OR u.id = ?)
     ORDER BY u.display_name`,
    [req.user.id, req.user.id],
  );
  res.json({ profiles: rows });
});

app.post('/api/member/support-request', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!required(req.body.request_type) || !required(req.body.message)) return res.status(400).json({ error: 'Invalid request' });
  const result = await run(
    'INSERT INTO email_support_requests (user_id, request_type, message, status) VALUES (?, ?, ?, ?)',
    [req.user.id, cleanString(req.body.request_type, 160), cleanString(req.body.message, 2000), 'open'],
  );
  await audit(req, 'support_request.create', req.user.id);
  res.json({ id: result.id });
});

app.get('/api/member/research-projects', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  const rows = await all(
    `SELECT DISTINCT p.* FROM research_projects p
     LEFT JOIN research_project_members m ON m.project_id = p.id AND m.user_id = ? AND m.active = 1
     WHERE p.created_by = ? OR p.project_lead_id = ? OR m.id IS NOT NULL OR p.visibility = 'members_only'
     ORDER BY p.updated_at DESC`,
    [req.user.id, req.user.id, req.user.id],
  );
  res.json({ projects: rows });
});

app.get('/api/member/research-projects/:id', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!(await canAccessProject(req.user, req.params.id))) return res.status(403).json({ error: 'Forbidden' });
  const project = await get('SELECT * FROM research_projects WHERE id = ?', [req.params.id]);
  const team = await all(
    `SELECT m.*, u.display_name, u.login_email FROM research_project_members m JOIN users u ON u.id = m.user_id
     WHERE m.project_id = ? ORDER BY m.joined_at`,
    [req.params.id],
  );
  res.json({ project, team });
});

app.post('/api/member/research-projects', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!required(req.body.title_en) || !required(req.body.title_mn)) return res.status(400).json({ error: 'Title is required' });
  const result = await run(
    `INSERT INTO research_projects
     (title_en, title_mn, summary_en, summary_mn, objective_en, objective_mn, category, country_focus, status, visibility, created_by, project_lead_id, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cleanString(req.body.title_en, 240),
      cleanString(req.body.title_mn, 240),
      cleanString(req.body.summary_en, 2000),
      cleanString(req.body.summary_mn, 2000),
      cleanString(req.body.objective_en, 2000),
      cleanString(req.body.objective_mn, 2000),
      cleanString(req.body.category, 120),
      cleanString(req.body.country_focus, 200),
      cleanString(req.body.status, 40) || 'idea',
      cleanString(req.body.visibility, 40) || 'team_only',
      req.user.id,
      req.user.id,
      cleanString(req.body.start_date, 40),
      cleanString(req.body.end_date, 40),
    ],
  );
  await run(
    'INSERT INTO research_project_members (project_id, user_id, project_role, invited_by, active) VALUES (?, ?, ?, ?, 1)',
    [result.id, req.user.id, 'Project Lead', req.user.id],
  );
  await audit(req, 'research_project.create', req.user.id);
  res.json({ id: result.id });
});

app.put('/api/member/research-projects/:id', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!(await canManageProject(req.user, req.params.id))) return res.status(403).json({ error: 'Forbidden' });
  await run(
    `UPDATE research_projects SET title_en=?, title_mn=?, summary_en=?, summary_mn=?, objective_en=?, objective_mn=?,
     category=?, country_focus=?, status=?, visibility=?, start_date=?, end_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [
      cleanString(req.body.title_en, 240),
      cleanString(req.body.title_mn, 240),
      cleanString(req.body.summary_en, 2000),
      cleanString(req.body.summary_mn, 2000),
      cleanString(req.body.objective_en, 2000),
      cleanString(req.body.objective_mn, 2000),
      cleanString(req.body.category, 120),
      cleanString(req.body.country_focus, 200),
      cleanString(req.body.status, 40),
      cleanString(req.body.visibility, 40),
      cleanString(req.body.start_date, 40),
      cleanString(req.body.end_date, 40),
      req.params.id,
    ],
  );
  await audit(req, 'research_project.update');
  res.json({ ok: true });
});

app.post('/api/member/research-projects/:id/join-request', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  await run(
    'INSERT INTO research_project_invitations (project_id, invited_user_id, invited_by, status, message) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, req.user.id, req.user.id, 'join_requested', cleanString(req.body.message, 1000)],
  );
  await audit(req, 'research_project.join_request');
  res.json({ ok: true });
});

app.get('/api/member/research-projects/:id/tasks', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!(await canAccessProject(req.user, req.params.id))) return res.status(403).json({ error: 'Forbidden' });
  res.json({ tasks: await all('SELECT * FROM research_project_tasks WHERE project_id = ? ORDER BY created_at DESC', [req.params.id]) });
});

app.post('/api/member/research-projects/:id/tasks', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!(await canAccessProject(req.user, req.params.id))) return res.status(403).json({ error: 'Forbidden' });
  const result = await run(
    `INSERT INTO research_project_tasks (project_id, title_en, title_mn, description_en, description_mn, assigned_to, priority, status, due_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.params.id,
      cleanString(req.body.title_en, 240),
      cleanString(req.body.title_mn, 240),
      cleanString(req.body.description_en, 1000),
      cleanString(req.body.description_mn, 1000),
      req.body.assigned_to || req.user.id,
      cleanString(req.body.priority, 40) || 'medium',
      cleanString(req.body.status, 40) || 'todo',
      cleanString(req.body.due_date, 40),
      req.user.id,
    ],
  );
  await audit(req, 'research_task.create');
  res.json({ id: result.id });
});

app.put('/api/member/research-tasks/:taskId', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  const task = await get('SELECT * FROM research_project_tasks WHERE id = ?', [req.params.taskId]);
  if (!task || !(await canAccessProject(req.user, task.project_id))) return res.status(403).json({ error: 'Forbidden' });
  await run('UPDATE research_project_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    cleanString(req.body.status, 40) || 'todo',
    req.params.taskId,
  ]);
  await audit(req, 'research_task.update');
  res.json({ ok: true });
});

app.get('/api/member/research-projects/:id/materials', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!(await canAccessProject(req.user, req.params.id))) return res.status(403).json({ error: 'Forbidden' });
  res.json({ materials: await all('SELECT * FROM research_project_materials WHERE project_id = ? ORDER BY created_at DESC', [req.params.id]) });
});

app.post('/api/member/research-projects/:id/materials', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!(await canAccessProject(req.user, req.params.id))) return res.status(403).json({ error: 'Forbidden' });
  const result = await run(
    'INSERT INTO research_project_materials (project_id, title, material_type, url, description, visibility, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      req.params.id,
      cleanString(req.body.title, 240),
      cleanString(req.body.material_type, 80) || 'link',
      cleanString(req.body.url, 700),
      cleanString(req.body.description, 1000),
      cleanString(req.body.visibility, 40) || 'team_only',
      req.user.id,
    ],
  );
  await audit(req, 'research_material.create');
  res.json({ id: result.id });
});

app.get('/api/member/research-projects/:id/comments', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!(await canAccessProject(req.user, req.params.id))) return res.status(403).json({ error: 'Forbidden' });
  const comments = await all(
    `SELECT c.*, u.display_name FROM research_project_comments c JOIN users u ON u.id = c.user_id
     WHERE c.project_id = ? ORDER BY c.created_at DESC`,
    [req.params.id],
  );
  res.json({ comments });
});

app.post('/api/member/research-projects/:id/comments', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!(await canAccessProject(req.user, req.params.id))) return res.status(403).json({ error: 'Forbidden' });
  const result = await run(
    'INSERT INTO research_project_comments (project_id, user_id, comment, comment_type) VALUES (?, ?, ?, ?)',
    [req.params.id, req.user.id, cleanString(req.body.comment, 3000), cleanString(req.body.comment_type, 80) || 'discussion'],
  );
  await audit(req, 'research_comment.create');
  res.json({ id: result.id });
});

app.post('/api/member/research-projects/:id/updates', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  if (!(await canAccessProject(req.user, req.params.id))) return res.status(403).json({ error: 'Forbidden' });
  const result = await run(
    'INSERT INTO research_project_updates (project_id, user_id, progress_percent, summary, blockers, next_steps) VALUES (?, ?, ?, ?, ?, ?)',
    [
      req.params.id,
      req.user.id,
      Number(req.body.progress_percent || 0),
      cleanString(req.body.summary, 2000),
      cleanString(req.body.blockers, 2000),
      cleanString(req.body.next_steps, 2000),
    ],
  );
  await audit(req, 'research_update.create');
  res.json({ id: result.id });
});

app.get('/api/member/research-invitations', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  const invitations = await all(
    `SELECT i.*, p.title_en, p.title_mn FROM research_project_invitations i
     JOIN research_projects p ON p.id = i.project_id
     WHERE i.invited_user_id = ? ORDER BY i.created_at DESC`,
    [req.user.id],
  );
  res.json({ invitations });
});

app.post('/api/member/research-invitations/:id/respond', auth, requireRole(['member', 'project_lead', 'admin']), async (req, res) => {
  const status = req.body.status === 'accepted' ? 'accepted' : 'declined';
  const invitation = await get('SELECT * FROM research_project_invitations WHERE id = ? AND invited_user_id = ?', [
    req.params.id,
    req.user.id,
  ]);
  if (!invitation) return res.status(404).json({ error: 'Not found' });
  await run('UPDATE research_project_invitations SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?', [
    status,
    req.params.id,
  ]);
  if (status === 'accepted') {
    await run(
      'INSERT OR IGNORE INTO research_project_members (project_id, user_id, project_role, invited_by, active) VALUES (?, ?, ?, ?, 1)',
      [invitation.project_id, req.user.id, 'Researcher', invitation.invited_by],
    );
  }
  await audit(req, `research_invitation.${status}`);
  res.json({ ok: true });
});

app.get('/api/admin/analytics/summary', auth, requireRole(['admin']), async (_req, res) => {
  const total = await get('SELECT COUNT(*) AS count FROM visits');
  const today = await get("SELECT COUNT(*) AS count FROM visits WHERE date(created_at) = date('now')");
  const uniqueToday = await get("SELECT COUNT(DISTINCT ip_hash) AS count FROM visits WHERE date(created_at) = date('now')");
  const month = await get("SELECT COUNT(*) AS count FROM visits WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')");
  const devices = await all('SELECT device_type, COUNT(*) AS count FROM visits GROUP BY device_type');
  const languages = await all('SELECT language, COUNT(*) AS count FROM visits GROUP BY language');
  res.json({ total: total.count, today: today.count, uniqueToday: uniqueToday.count, month: month.count, devices, languages });
});

app.get('/api/admin/analytics/daily', auth, requireRole(['admin']), async (_req, res) => {
  res.json({ rows: await all("SELECT date(created_at) AS day, COUNT(*) AS visits FROM visits GROUP BY day ORDER BY day DESC LIMIT 30") });
});

app.get('/api/admin/analytics/top-pages', auth, requireRole(['admin']), async (_req, res) => {
  res.json({ rows: await all('SELECT path, COUNT(*) AS visits FROM visits GROUP BY path ORDER BY visits DESC LIMIT 10') });
});

app.get('/api/admin/analytics/recent-visits', auth, requireRole(['admin']), async (_req, res) => {
  res.json({ rows: await all('SELECT path, page_title, language, referrer, browser, device_type, country, created_at FROM visits ORDER BY created_at DESC LIMIT 25') });
});

app.get('/api/admin/members', auth, requireRole(['admin']), async (_req, res) => {
  res.json({ members: await all('SELECT id, username, login_email, role, display_name, active, force_password_change, created_at, last_login_at FROM users ORDER BY created_at DESC') });
});

app.post('/api/admin/members', auth, requireRole(['admin']), async (req, res) => {
  const username = cleanString(req.body.username, 80);
  const email = cleanString(req.body.login_email, 180).toLowerCase();
  const password = String(req.body.password || '');
  if (!username || !email || password.length < 10) return res.status(400).json({ error: 'Username, email, and a 10+ character password are required.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const role = ['member', 'project_lead', 'admin'].includes(req.body.role) ? req.body.role : 'member';
  const result = await run(
    'INSERT INTO users (username, login_email, password_hash, role, display_name, active, force_password_change) VALUES (?, ?, ?, ?, ?, 1, 1)',
    [username, email, passwordHash, role, cleanString(req.body.display_name, 160) || username],
  );
  await run('INSERT INTO member_profiles (user_id, organization, visibility) VALUES (?, ?, ?)', [result.id, 'IDEA', 'members_only']);
  await run('INSERT INTO email_accounts (user_id, email_address, provider, webmail_url, status) VALUES (?, ?, ?, ?, ?)', [
    result.id,
    cleanString(req.body.idea_email, 180) || email,
    'manual',
    getWebmailUrl(),
    'pending_setup',
  ]);
  await audit(req, 'admin.member.create', result.id);
  res.json({ id: result.id });
});

app.put('/api/admin/members/:id', auth, requireRole(['admin']), async (req, res) => {
  await run('UPDATE users SET display_name=?, role=?, active=? WHERE id=?', [
    cleanString(req.body.display_name, 160),
    ['member', 'project_lead', 'admin'].includes(req.body.role) ? req.body.role : 'member',
    req.body.active ? 1 : 0,
    req.params.id,
  ]);
  await audit(req, 'admin.member.update', req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/members/:id/reset-password', auth, requireRole(['admin']), async (req, res) => {
  const password = String(req.body.password || '');
  if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });
  await run('UPDATE users SET password_hash=?, force_password_change=1 WHERE id=?', [await bcrypt.hash(password, 12), req.params.id]);
  await audit(req, 'admin.member.reset_password', req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/membership-applications', auth, requireRole(['admin']), async (_req, res) => {
  const rows = await all(
    `SELECT id, full_name, email, organization, requested_idea_email, status, created_at
     FROM membership_applications ORDER BY created_at DESC`,
  );
  res.json({ applications: rows });
});

app.get('/api/admin/membership-applications/:id', auth, requireRole(['admin']), async (req, res) => {
  const application = await get('SELECT * FROM membership_applications WHERE id = ?', [req.params.id]);
  if (!application) return res.status(404).json({ error: 'Not found' });
  res.json({ application });
});

app.put('/api/admin/membership-applications/:id/status', auth, requireRole(['admin']), async (req, res) => {
  const status = cleanString(req.body.status, 40);
  const allowed = ['pending', 'under_review', 'approved', 'rejected', 'more_info_requested'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await run(
    `UPDATE membership_applications
     SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, cleanString(req.body.admin_notes, 2000), req.user.id, req.params.id],
  );
  const action = {
    under_review: 'membership_application_under_review',
    approved: 'membership_application_approved',
    rejected: 'membership_application_rejected',
    more_info_requested: 'membership_application_more_info_requested',
    pending: 'membership_application_pending',
  }[status];
  await audit(req, action);
  res.json({ ok: true });
});

app.post('/api/admin/membership-applications/:id/reject', auth, requireRole(['admin']), async (req, res) => {
  req.body.status = 'rejected';
  await run(
    `UPDATE membership_applications
     SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [cleanString(req.body.admin_notes, 2000), req.user.id, req.params.id],
  );
  await audit(req, 'membership_application_rejected');
  res.json({ ok: true });
});

app.post('/api/admin/membership-applications/:id/request-more-info', auth, requireRole(['admin']), async (req, res) => {
  await run(
    `UPDATE membership_applications
     SET status = 'more_info_requested', admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [cleanString(req.body.admin_notes, 2000), req.user.id, req.params.id],
  );
  await audit(req, 'membership_application_more_info_requested');
  res.json({ ok: true });
});

app.post('/api/admin/membership-applications/:id/approve', auth, requireRole(['admin']), async (req, res) => {
  const application = await get('SELECT * FROM membership_applications WHERE id = ?', [req.params.id]);
  if (!application) return res.status(404).json({ error: 'Not found' });
  if (application.created_user_id) return res.status(400).json({ error: 'Member account already created.' });

  const username = safeEmailUsername(req.body.username || application.requested_email_username);
  const displayName = cleanString(req.body.display_name, 180) || application.full_name;
  const loginEmail = cleanString(req.body.login_email, 180).toLowerCase() || application.email;
  const ideaEmail = cleanString(req.body.idea_email, 180).toLowerCase() || application.requested_idea_email;
  const role = ['member', 'project_lead', 'admin'].includes(req.body.role) ? req.body.role : 'member';
  const emailStatus = ['not_assigned', 'pending_setup', 'active', 'suspended'].includes(req.body.email_status)
    ? req.body.email_status
    : 'pending_setup';
  const password = String(req.body.temporary_password || '') || temporaryPassword();

  if (!username || !loginEmail.includes('@') || !ideaEmail.endsWith('@idea.org.mn')) {
    return res.status(400).json({ error: 'Username, login email, and IDEA email are required.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await run(
    `INSERT INTO users (username, login_email, password_hash, role, display_name, active, force_password_change)
     VALUES (?, ?, ?, ?, ?, 1, 1)`,
    [username, loginEmail, passwordHash, role, displayName],
  );
  await run(
    `INSERT INTO member_profiles (user_id, position, organization, phone, bio, visibility)
     VALUES (?, ?, ?, ?, ?, 'members_only')`,
    [result.id, application.position, application.organization, application.phone, application.short_bio],
  );
  await run(
    `INSERT INTO email_accounts (user_id, email_address, provider, webmail_url, status, notes)
     VALUES (?, ?, 'manual', ?, ?, ?)`,
    [result.id, ideaEmail, getWebmailUrl(), emailStatus, 'Created after admin approval of membership application.'],
  );
  await run(
    `UPDATE membership_applications
     SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, created_user_id = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [req.user.id, result.id, cleanString(req.body.admin_notes, 2000), req.params.id],
  );

  if (!req.body.temporary_password) {
    saveGeneratedCredential(username, password, 'membership-approval');
  }

  const onboarding = {
    en: `Hello ${displayName},\n\nYour IDEA member account has been approved.\n\nWebsite:\nhttps://idea.org.mn\n\nLogin:\n${loginEmail || username}\n\nIDEA email:\n${ideaEmail}\n\nTemporary password:\n${password}\n\nPlease change your password after your first login.`,
    mn: `Сайн байна уу, ${displayName},\n\nТаны IDEA хүрээлэнгийн гишүүний хүсэлт зөвшөөрөгдөж, гишүүний эрх үүссэн байна.\n\nВэбсайт:\nhttps://idea.org.mn\n\nНэвтрэх нэр:\n${loginEmail || username}\n\nIDEA имэйл:\n${ideaEmail}\n\nТүр нууц үг:\n${password}\n\nАнх нэвтэрсний дараа нууц үгээ солино уу.`,
  };

  await audit(req, 'membership_application_approved', result.id);
  await audit(req, 'member_created_from_application', result.id);
  res.json({ id: result.id, onboarding, temporary_password: password });
});

app.get('/api/admin/email-accounts', auth, requireRole(['admin']), async (_req, res) => {
  const rows = await all(
    `SELECT e.*, u.display_name, u.username FROM email_accounts e JOIN users u ON u.id = e.user_id ORDER BY u.display_name`,
  );
  res.json({ accounts: rows, provider_mode: process.env.EMAIL_PROVIDER_MODE || 'manual' });
});

app.put('/api/admin/email-accounts/:id', auth, requireRole(['admin']), async (req, res) => {
  await run('UPDATE email_accounts SET email_address=?, webmail_url=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [
    cleanString(req.body.email_address, 180),
    cleanString(req.body.webmail_url, 500) || getWebmailUrl(),
    cleanString(req.body.status, 40) || 'pending_setup',
    cleanString(req.body.notes, 1000),
    req.params.id,
  ]);
  await audit(req, 'admin.email.update');
  res.json({ ok: true });
});

app.get('/api/admin/research-partnerships', auth, requireRole(['admin']), async (_req, res) => {
  res.json({ items: await all('SELECT * FROM research_partnerships ORDER BY updated_at DESC') });
});

app.post('/api/admin/research-partnerships', auth, requireRole(['admin']), async (req, res) => {
  const result = await run(
    'INSERT INTO research_partnerships (title_en, title_mn, description_en, description_mn, category, country, status, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      cleanString(req.body.title_en, 240),
      cleanString(req.body.title_mn, 240),
      cleanString(req.body.description_en, 2000),
      cleanString(req.body.description_mn, 2000),
      cleanString(req.body.category, 120),
      cleanString(req.body.country, 120),
      cleanString(req.body.status, 60) || 'active',
      cleanString(req.body.visibility, 60) || 'members_only',
    ],
  );
  await audit(req, 'admin.research_partnership.create');
  res.json({ id: result.id });
});

app.put('/api/admin/research-partnerships/:id', auth, requireRole(['admin']), async (req, res) => {
  await run(
    `UPDATE research_partnerships SET title_en=?, title_mn=?, description_en=?, description_mn=?, category=?, country=?, status=?, visibility=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [
      cleanString(req.body.title_en, 240),
      cleanString(req.body.title_mn, 240),
      cleanString(req.body.description_en, 2000),
      cleanString(req.body.description_mn, 2000),
      cleanString(req.body.category, 120),
      cleanString(req.body.country, 120),
      cleanString(req.body.status, 60),
      cleanString(req.body.visibility, 60),
      req.params.id,
    ],
  );
  await audit(req, 'admin.research_partnership.update');
  res.json({ ok: true });
});

app.get('/api/admin/member-profiles', auth, requireRole(['admin']), async (_req, res) => {
  const profiles = await all(
    `SELECT p.*, u.display_name, u.login_email, e.email_address FROM member_profiles p
     JOIN users u ON u.id = p.user_id LEFT JOIN email_accounts e ON e.user_id = u.id ORDER BY u.display_name`,
  );
  res.json({ profiles });
});

app.put('/api/admin/member-profiles/:id', auth, requireRole(['admin']), async (req, res) => {
  await run(
    'UPDATE member_profiles SET position=?, organization=?, phone=?, bio=?, photo_url=?, visibility=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [
      cleanString(req.body.position, 200),
      cleanString(req.body.organization, 200),
      cleanString(req.body.phone, 80),
      cleanString(req.body.bio, 2000),
      cleanString(req.body.photo_url, 500),
      cleanString(req.body.visibility, 40),
      req.params.id,
    ],
  );
  await audit(req, 'admin.profile.update');
  res.json({ ok: true });
});

app.get('/api/admin/support-requests', auth, requireRole(['admin']), async (_req, res) => {
  const rows = await all(
    `SELECT r.*, u.display_name, u.login_email FROM email_support_requests r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC`,
  );
  res.json({ requests: rows });
});

app.put('/api/admin/support-requests/:id', auth, requireRole(['admin']), async (req, res) => {
  const status = cleanString(req.body.status, 40);
  await run('UPDATE email_support_requests SET status=?, resolved_at = CASE WHEN ? = "resolved" THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id=?', [
    status,
    status,
    req.params.id,
  ]);
  await audit(req, 'admin.support_request.update');
  res.json({ ok: true });
});

app.get('/api/admin/audit-logs', auth, requireRole(['admin']), async (_req, res) => {
  res.json({ logs: await all('SELECT a.*, u.display_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 100') });
});

app.get('/api/admin/research-projects', auth, requireRole(['admin']), async (_req, res) => {
  res.json({ projects: await all('SELECT * FROM research_projects ORDER BY updated_at DESC') });
});

app.post('/api/admin/research-projects', auth, requireRole(['admin']), async (req, res) => {
  const leadId = req.body.project_lead_id || req.user.id;
  const result = await run(
    `INSERT INTO research_projects (title_en, title_mn, summary_en, summary_mn, objective_en, objective_mn, category, country_focus, status, visibility, created_by, project_lead_id, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cleanString(req.body.title_en, 240),
      cleanString(req.body.title_mn, 240),
      cleanString(req.body.summary_en, 2000),
      cleanString(req.body.summary_mn, 2000),
      cleanString(req.body.objective_en, 2000),
      cleanString(req.body.objective_mn, 2000),
      cleanString(req.body.category, 120),
      cleanString(req.body.country_focus, 200),
      cleanString(req.body.status, 40) || 'idea',
      cleanString(req.body.visibility, 40) || 'team_only',
      req.user.id,
      leadId,
      cleanString(req.body.start_date, 40),
      cleanString(req.body.end_date, 40),
    ],
  );
  await run('INSERT OR IGNORE INTO research_project_members (project_id, user_id, project_role, invited_by, active) VALUES (?, ?, ?, ?, 1)', [
    result.id,
    leadId,
    'Project Lead',
    req.user.id,
  ]);
  await audit(req, 'admin.research_project.create');
  res.json({ id: result.id });
});

app.put('/api/admin/research-projects/:id', auth, requireRole(['admin']), async (req, res) => {
  req.params.id = String(req.params.id);
  req.body.project_lead_id = req.body.project_lead_id || req.user.id;
  await run(
    `UPDATE research_projects SET title_en=?, title_mn=?, summary_en=?, summary_mn=?, objective_en=?, objective_mn=?, category=?, country_focus=?, status=?, visibility=?, project_lead_id=?, start_date=?, end_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [
      cleanString(req.body.title_en, 240),
      cleanString(req.body.title_mn, 240),
      cleanString(req.body.summary_en, 2000),
      cleanString(req.body.summary_mn, 2000),
      cleanString(req.body.objective_en, 2000),
      cleanString(req.body.objective_mn, 2000),
      cleanString(req.body.category, 120),
      cleanString(req.body.country_focus, 200),
      cleanString(req.body.status, 40),
      cleanString(req.body.visibility, 40),
      req.body.project_lead_id,
      cleanString(req.body.start_date, 40),
      cleanString(req.body.end_date, 40),
      req.params.id,
    ],
  );
  await audit(req, 'admin.research_project.update');
  res.json({ ok: true });
});

app.delete('/api/admin/research-projects/:id', auth, requireRole(['admin']), async (req, res) => {
  await run("UPDATE research_projects SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE id=?", [req.params.id]);
  await audit(req, 'admin.research_project.archive');
  res.json({ ok: true });
});

app.post('/api/admin/research-projects/:id/members', auth, requireRole(['admin']), async (req, res) => {
  const result = await run(
    'INSERT OR REPLACE INTO research_project_members (project_id, user_id, project_role, invited_by, active) VALUES (?, ?, ?, ?, 1)',
    [req.params.id, req.body.user_id, cleanString(req.body.project_role, 80) || 'Researcher', req.user.id],
  );
  await audit(req, 'admin.research_project.member.add', req.body.user_id);
  res.json({ id: result.id });
});

app.put('/api/admin/research-projects/:id/members/:memberId', auth, requireRole(['admin']), async (req, res) => {
  await run('UPDATE research_project_members SET project_role=?, active=? WHERE project_id=? AND id=?', [
    cleanString(req.body.project_role, 80),
    req.body.active ? 1 : 0,
    req.params.id,
    req.params.memberId,
  ]);
  await audit(req, 'admin.research_project.member.update');
  res.json({ ok: true });
});

app.delete('/api/admin/research-projects/:id/members/:memberId', auth, requireRole(['admin']), async (req, res) => {
  await run('UPDATE research_project_members SET active=0 WHERE project_id=? AND id=?', [req.params.id, req.params.memberId]);
  await audit(req, 'admin.research_project.member.remove');
  res.json({ ok: true });
});

for (const endpoint of ['tasks', 'materials', 'comments', 'updates']) {
  app.get(`/api/admin/research-projects/:id/${endpoint}`, auth, requireRole(['admin']), async (req, res) => {
    const table = {
      tasks: 'research_project_tasks',
      materials: 'research_project_materials',
      comments: 'research_project_comments',
      updates: 'research_project_updates',
    }[endpoint];
    res.json({ [endpoint]: await all(`SELECT * FROM ${table} WHERE project_id = ? ORDER BY created_at DESC`, [req.params.id]) });
  });
}

app.use(express.static(distDir));
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`IDEA app listening on port ${port}`);
});
