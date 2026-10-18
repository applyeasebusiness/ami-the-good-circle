# AMI – The Good Circle website + backend

This package preserves the existing multipage HTML/CSS design and adds Vercel serverless form submission, Supabase storage, and a private admin dashboard for submissions, events, and gallery items. Donations/payment processing are intentionally not included.

## Architecture
- Static public website and `/api/submit` serverless function: Vercel.
- Private submissions, events, gallery metadata and admin profiles: Supabase Postgres with Row Level Security (RLS).
- Admin sign-in: Supabase Auth.
- Gallery images: Supabase Storage bucket `ami-gallery` (public image delivery; authenticated AMI admins only can upload/update/delete).
- Public events page: displays only published events and gallery items.

## Exact setup sequence

### 1. Apply the database schema
1. Sign in to the Supabase project you already have.
2. Open **SQL Editor → New query**.
3. Paste the full contents of `supabase/schema.sql` and run it.
4. Check that the tables `form_submissions`, `profiles`, `events`, and `gallery_items` exist, and that the `ami-gallery` Storage bucket exists.
5. Review the RLS policies in **Database → Tables**. Do not disable RLS to make the dashboard work.

### 2. Configure the public Supabase client
1. In Supabase **Project Settings → API** (or the project's API keys page), copy the Project URL and the **publishable/anon key**.
2. Edit `admin-config.js` and replace `https://YOUR_PROJECT_REF.supabase.co` and `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with those values.
3. The publishable/anon key is meant to be used in browser code; RLS must protect every table. **Never put `SUPABASE_SERVICE_ROLE_KEY` or a secret key in `admin-config.js`, HTML, or any browser JavaScript.**

### 3. Configure the server-only form endpoint
In Vercel → Project → Settings → Environment Variables, add these for Production (and Preview if desired):
- `SUPABASE_URL` = your Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service-role/secret key

These variables are used only by `/api/submit`. Do not commit the real values to GitHub. Redeploy after changing environment variables.

### 4. Deploy from GitHub Actions to Vercel
The workflow in `.github/workflows/deploy.yml` deploys to Vercel when code is pushed to `main` or `master`, or when you run it manually from the GitHub **Actions** tab.

1. Add this project to a GitHub repository. Preserve the existing `assets/ami-logo.jpg` file if it is already in that repository; this package intentionally does not replace or redraw the official logo.
2. Link this project to the intended Vercel project from the project folder by running `vercel link`. The generated `.vercel/project.json` contains `orgId` and `projectId`; `.vercel/` is ignored by Git and should not be committed.
3. In Vercel, create a deployment token under **Account Settings → Tokens**. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add these repository secrets:
   - `VERCEL_TOKEN` = the Vercel deployment token
   - `VERCEL_ORG_ID` = the `orgId` from `.vercel/project.json`
   - `VERCEL_PROJECT_ID` = the `projectId` from `.vercel/project.json`
4. Confirm that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured in the Vercel project's Production environment as described above. The workflow pulls that environment before building; never put the service-role key in GitHub source files or browser code.
5. Push the changes to `main` or `master`. In GitHub, open **Actions** and wait for **Deploy to Vercel** to complete. Visit `/admin.html` and `/events.html` on the deployed domain.

If Vercel is also configured to deploy this same repository directly on every Git push, disable that automatic Git deployment to avoid duplicate builds; use this workflow as the deployment path.

### 5. Create the first administrator safely
1. In Supabase → **Authentication → Users**, create the initial admin user using an organization-controlled email address. If email confirmation is required, complete it.
2. Copy that user's UUID from the Auth user list.
3. In Supabase SQL Editor, run the following after replacing the UUID and display name:

```sql
insert into public.profiles (id, display_name, role)
values ('PASTE-AUTH-USER-UUID-HERE', 'AMI Administrator', 'admin')
on conflict (id) do update
set role = 'admin', display_name = excluded.display_name;
```

4. Open `/admin.html`, sign in with that user, and verify the dashboard loads. Do not add public sign-up to the dashboard. To remove admin access, update the profile role to `viewer` or delete the profile.

### 6. Smoke-test before accepting real information
- Contact form: submit clearly marked test data; verify a row appears in `form_submissions`.
- Volunteer form: submit test data and confirm form type `volunteer`.
- Membership form: submit test data and confirm form type `membership`.
- Public visitor: confirm `/admin.html` cannot show data without a valid admin login.
- Admin: change a test submission status and add an internal note; reload and confirm it persisted.
- Events: create a draft, confirm it is not visible on `/events.html`; publish it and confirm it appears; edit and delete the test event.
- Gallery: upload a permitted test image under 5 MB, save as draft, then publish and verify it appears publicly; delete the test item afterwards.
- Confirm that a non-admin authenticated user cannot read submissions, write events/gallery, or upload gallery images.
- Test on mobile and desktop, and check the Vercel Function logs for server errors.

## Dashboard features
- `/admin.html`: authenticated admin login; no public sign-up.
- Submissions: view up to 500 most recent records, filter by status, change status (`new`, `in_review`, `responded`, `closed`), and store private admin notes.
- Events: create/edit/delete events, choose draft/published/archived status, add date, venue, cover image URL, and HTTPS registration URL.
- Gallery: upload JPG/PNG/WebP images up to 5 MB, edit alt text/caption/date, publish or keep private, set sort order, and delete metadata records.
- `/events.html`: reads only published event and gallery records.

## Production hardening still required
- This starter uses a honeypot and request-size checks, but does **not** include durable rate limiting or CAPTCHA. Add a rate limiter/bot protection before promoting forms widely.
- Define who can access personal data, a retention/deletion schedule, incident response, and an accurate privacy notice before collecting real submissions.
- Keep admin accounts limited to trusted people, use strong unique passwords and MFA where available, and periodically review users and policies.
- Public gallery image URLs are intentionally readable. Do not upload private images or images without publication consent. Deleting a gallery record does not automatically delete the stored image file; clean up unused files in Storage.
- The existing `assets/ami-logo.jpg` is referenced by the HTML but was not present in the files inspected in this package. Preserve/add the exact approved logo asset at that path before deployment; do not substitute a generated logo.
- The public homepage still contains the starter featured-event section. Keep its details consistent with the event record or update it to use the managed event data before publishing new event information.
- The Privacy Policy, contact details, organization profile and event status need review/completion before launch.
- AMI is currently an unregistered community group. Donations, payment processing and tax-benefit claims remain disabled until legal status, applicable fundraising rules, account ownership and any required approvals are verified with a qualified professional.

## Local preview
Opening HTML directly will not run the Vercel API. You may preview static pages with `python -m http.server 8000`, but authentication/database access requires the configured Supabase project and an internet connection. Test `/api/submit` on a Vercel deployment or with Vercel's local development tooling.
