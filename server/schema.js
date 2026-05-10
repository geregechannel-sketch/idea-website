import { exec } from './db.js';

export async function initSchema() {
  await exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      login_email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('public','member','project_lead','admin')),
      display_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      force_password_change INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS member_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      position TEXT DEFAULT '',
      organization TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'members_only' CHECK (visibility IN ('private','members_only','public')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS membership_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      organization TEXT NOT NULL,
      position TEXT NOT NULL,
      research_interests TEXT NOT NULL,
      reason_for_joining TEXT NOT NULL,
      requested_email_username TEXT NOT NULL,
      requested_idea_email TEXT NOT NULL,
      short_bio TEXT DEFAULT '',
      expertise_area TEXT DEFAULT '',
      professional_profile_url TEXT DEFAULT '',
      supporting_document_path TEXT DEFAULT '',
      supporting_document_original_name TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected','more_info_requested')),
      admin_notes TEXT DEFAULT '',
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      created_user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      email_address TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'manual',
      webmail_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_setup' CHECK (status IN ('not_assigned','pending_setup','active','suspended')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      page_title TEXT DEFAULT '',
      language TEXT DEFAULT 'EN',
      referrer TEXT DEFAULT '',
      utm_source TEXT DEFAULT '',
      utm_medium TEXT DEFAULT '',
      utm_campaign TEXT DEFAULT '',
      browser TEXT DEFAULT '',
      device_type TEXT DEFAULT '',
      ip_hash TEXT DEFAULT '',
      country TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS research_partnerships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_en TEXT NOT NULL,
      title_mn TEXT NOT NULL,
      description_en TEXT NOT NULL,
      description_mn TEXT NOT NULL,
      category TEXT DEFAULT '',
      country TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      visibility TEXT DEFAULT 'members_only',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS research_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_en TEXT NOT NULL,
      title_mn TEXT NOT NULL,
      summary_en TEXT DEFAULT '',
      summary_mn TEXT DEFAULT '',
      objective_en TEXT DEFAULT '',
      objective_mn TEXT DEFAULT '',
      category TEXT DEFAULT '',
      country_focus TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'idea',
      visibility TEXT NOT NULL DEFAULT 'team_only',
      created_by INTEGER REFERENCES users(id),
      project_lead_id INTEGER REFERENCES users(id),
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS research_project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_role TEXT NOT NULL DEFAULT 'Researcher',
      invited_by INTEGER REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS research_project_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
      title_en TEXT NOT NULL,
      title_mn TEXT NOT NULL,
      description_en TEXT DEFAULT '',
      description_mn TEXT DEFAULT '',
      assigned_to INTEGER REFERENCES users(id),
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'todo',
      due_date TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS research_project_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
      title_en TEXT NOT NULL,
      title_mn TEXT NOT NULL,
      description_en TEXT DEFAULT '',
      description_mn TEXT DEFAULT '',
      due_date TEXT,
      status TEXT DEFAULT 'todo',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS research_project_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      material_type TEXT DEFAULT 'link',
      url TEXT NOT NULL,
      description TEXT DEFAULT '',
      visibility TEXT DEFAULT 'team_only',
      uploaded_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS research_project_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      comment TEXT NOT NULL,
      comment_type TEXT DEFAULT 'discussion',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS research_project_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      progress_percent INTEGER DEFAULT 0,
      summary TEXT DEFAULT '',
      blockers TEXT DEFAULT '',
      next_steps TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS research_project_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
      invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invited_by INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending',
      message TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      responded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS email_support_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_type TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      target_user_id INTEGER REFERENCES users(id),
      ip_hash TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
