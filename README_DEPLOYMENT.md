# IDEA web application deployment guide

This project is a bilingual English/Mongolian web application for IDEA — Institute for Development of Ethical AI / Хиймэл оюуны санаачлага хүрээлэн.

It uses:

- React + TypeScript + Vite frontend
- Node.js + Express backend
- SQLite database
- HTTP-only cookie authentication
- Manual IDEA email provisioning mode

## 1. Upload the project to cPanel

Upload the whole project folder to your cPanel account outside `public_html`, for example:

`/home/ideaorgm/idea-app`

Do not upload `initial-credentials.local.txt` into `public_html`.

## 2. Create a Node.js app in cPanel

Open **Setup Node.js App** in cPanel.

Recommended settings:

- Node.js version: 20 or newer
- Application mode: Production
- Application root: `idea-app`
- Application URL: `idea.org.mn`
- Application startup file: `server/index.js`

Save the application.

## 3. Install dependencies

In cPanel Terminal, go to the application root:

```bash
cd ~/idea-app
npm install
```

## 4. Set environment variables

In cPanel Node.js App settings, add:

```bash
PORT=3000
NODE_ENV=production
JWT_SECRET=replace_with_a_long_random_secret
WEBMAIL_URL=https://webmail.idea.org.mn
EMAIL_PROVIDER_MODE=manual
```

Optional seed passwords:

```bash
SEED_PASSWORD_ALTANZUL=
SEED_PASSWORD_ENKHBOLD=
SEED_PASSWORD_KHULAN=
SEED_PASSWORD_JAMSRANDORJ=
SEED_PASSWORD_MUNKHSOLONGO=
SEED_PASSWORD_LKHAGVASUREN=
SEED_PASSWORD_TSEDENDORJ=
SEED_PASSWORD_ADMIN=
```

If a seed password is empty, the seed script generates a strong temporary password.

## 5. Build the frontend

```bash
npm run build
```

The Express app serves the generated `dist` folder.

## 6. Initialize SQLite

```bash
npm run db:init
```

The SQLite database is created at:

`server/data/idea.sqlite`

## 7. Seed initial users

```bash
npm run seed
```

Seeded users:

- altanzul
- enkhbold
- khulan
- jamsrandorj
- munkhsolongo
- lkhagvasuren
- tsedendorj
- admin

All seeded users have `force_password_change = true`.

## 8. Find generated temporary passwords

If seed password environment variables were not set, generated temporary passwords are saved in:

`initial-credentials.local.txt`

Keep this file private. It is included in `.gitignore` and must never be placed in `public_html`.

After users log in for the first time, they must change their password.

## 9. Manual email provisioning

The first version uses:

`EMAIL_PROVIDER_MODE=manual`

This means the website does not directly create real mailboxes.

Admin workflow:

1. Create mailbox manually in Datacom Email Host, cPanel Email, Google Workspace, Microsoft 365, or another provider.
2. Open the IDEA admin dashboard.
3. Record the IDEA email address, webmail URL, status, and notes.
4. The member sees the assigned email and webmail link in **My Email**.

Future API modes are reserved in `server/emailProviderService.js`:

- `cpanel_api_future`
- `datacom_api_future`
- `google_workspace_future`
- `microsoft_365_future`

## 10. Configure WEBMAIL_URL

Set:

```bash
WEBMAIL_URL=https://webmail.idea.org.mn
```

Members use this URL from the **My Email** page.

## 11. Restart the Node.js app

After changing environment variables, running migrations, or uploading new files:

1. Open **Setup Node.js App** in cPanel.
2. Select the IDEA application.
3. Click **Restart**.

## 12. Test unified login

1. Open `https://idea.org.mn/login`.
2. Choose **Member Login** or **Admin Login**.
3. Log in with a seeded username or email.
4. Change the password when prompted.
5. Confirm the correct dashboard loads.

Old routes are redirected by the frontend:

- `/member-login` to `/login?role=member`
- `/admin-login` to `/login?role=admin`

## 13. Test membership application

1. Open `https://idea.org.mn/apply`.
2. Complete the short application form.
3. Confirm both consent checkboxes.
4. Submit the application.
5. Confirm the success message appears.

The application is saved as `pending`. No active member account is created automatically.

## 14. Test admin approval of membership applications

1. Log in as admin through `https://idea.org.mn/login?role=admin`.
2. Open **Membership Applications**.
3. Review the submitted application.
4. Approve, reject, or request more information.
5. When approving, set username, display name, login email, IDEA email, role, email status, and optional temporary password.
6. If the temporary password is blank, the system generates one and appends it to `initial-credentials.local.txt`.
7. Copy the onboarding text shown once to the administrator.

## 15. Test member login

1. Open `https://idea.org.mn/login?role=member`.
2. Log in with a seeded member username or an approved member account.
3. Change the password when prompted.
4. Confirm the member dashboard loads.

## 16. Test admin login

1. Open `https://idea.org.mn/login?role=admin`.
2. Log in with `admin` or `admin@idea.org.mn`.
3. Change the password when prompted.
4. Confirm the admin dashboard loads.

## 17. Test Research Partnerships access

Public visitors should only see the teaser:

“Research Partnerships are available to registered IDEA members.”

Logged-in members and admins should see the protected Research Partnerships content.

## 18. Test Research Collaboration Hub

Member test:

1. Log in as a member.
2. Open **Research Collaboration**.
3. Create a new research proposal.
4. Confirm it appears in My Research Projects.

Admin test:

1. Log in as admin.
2. Open **Research Projects**.
3. Create or review research projects.
4. Assign project leads and manage project members through the API/admin screens.

## 16. Visitor analytics

The app tracks privacy-conscious visit data:

- Page path
- Page title
- Language
- Timestamp
- Referrer
- UTM parameters
- Browser family
- Device type
- Country from request headers if available
- Hashed IP address only

The app does not store raw IP addresses, passwords, or sensitive research documents.

## 17. Security checklist

- Use a long random `JWT_SECRET`.
- Keep `.env` private.
- Keep `initial-credentials.local.txt` private.
- Do not upload SQLite files to public web directories.
- Use HTTPS on the domain.
- Restart the Node.js app after deployment changes.
