# AMI – The Good Circle website starter

Responsive static website starter for AMI – The Good Circle, built with HTML, CSS and vanilla JavaScript.

## Pages
- `index.html` — homepage and volunteer-interest form
- `about.html` — about, vision, mission and values
- `initiatives.html` — Nature, Society and Culture
- `events.html` — Art for Assam 2026 and gallery placeholders
- `membership.html` — membership-interest form
- `donate.html` — donation information and compliance checklist
- `transparency.html` — public reports and document placeholders
- `contact.html` — contact information and enquiry form
- `privacy.html` — privacy policy draft
- `404.html` — custom not-found page

## Preview locally
Open `index.html` in a browser, or run:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000`.

## Deploy to Vercel
1. Extract this ZIP on your computer.
2. Create a GitHub repository for the website and upload the extracted files to its root.
3. Sign in to Vercel and choose **Add New → Project**.
4. Import the GitHub repository.
5. For this static site, leave the framework preset as **Other**. No build command is needed; leave the output directory blank/default unless Vercel asks for one.
6. Deploy and test the generated Vercel URL on mobile and desktop.
7. Add a custom domain in Vercel only after you choose and purchase a domain. Follow Vercel's exact DNS instructions.
8. After every important change, commit and push the changes to GitHub; Vercel will redeploy.

The included `vercel.json` enables clean URLs and adds a few baseline security headers. It is not a substitute for a security review.

## Current limitations — do not overlook
- **Forms are demo-only.** They validate in the browser and display a message, but do not send or store submissions. Do not advertise them as working registration or contact forms until a backend is connected and tested.
- **Donations are disabled.** The donate page is informational only. AMI has stated that it is currently a community group and is not yet registered. Do not collect online donations or promise tax deductions through this site until the organization's legal position, fundraising rules, payment account and any required registrations/approvals have been checked with a qualified professional.
- **WhatsApp is a placeholder.** Replace `91XXXXXXXXXX` with AMI's official number in international format; otherwise remove the link.
- **Event registration is a placeholder.** Add the real registration link and verify event status before launch. The poster lists 17 October 2026; confirm whether registration is open, closed or full at the time of publication.
- **Official logo not yet installed.** Replace the temporary text mark after the approved logo is supplied.
- **Contact details and organizational documents are placeholders.** Add only verified public details.
- **Privacy policy is a draft.** Complete it to match actual data handling and get appropriate review before collecting personal information.

## Before going public
1. Supply the approved logo and any authorized photographs.
2. Confirm official contact details and the exact public-facing organization name.
3. Decide which pages should be public now and which should remain hidden until content is ready.
4. Add a real form backend with validation, spam protection, secure storage, restricted admin access and a privacy notice.
5. Test all links, mobile layouts, keyboard navigation and form error states.
6. Add a custom domain, HTTPS, backups and basic uptime monitoring.
7. Review all legal, privacy and fundraising wording for accuracy.

## Suggested next technical stage
Keep this first release static. Once the organization is ready, connect forms through a server-side endpoint or a reputable form service. Never place private API keys in browser JavaScript or commit secrets to GitHub.
