# Deployment

Production deployment runs on Vercel at https://vocab-app-taupe.vercel.app/.

## Corporate Proxy Categorization

**Issue (2026-05-05):** Symantec Edge SWG (Swiss Post corporate proxy) blocked `POST https://vocab-app-taupe.vercel.app/api/translate` with category **Suspicious**.

**Cause:** Auto-generated `*.vercel.app` subdomains with random-word suffixes (`-taupe`) are heavily abused by phishing kits and short-lived malware C2s, so Symantec's WebPulse categorization defaults unknown subdomains to "Suspicious" — especially for `POST /api/*` traffic, which heuristically resembles credential exfiltration.

**Resolution:** Whitelisted via Swiss Post UHD. The app works on the corporate network again.

**Long-term fix (not yet done):** Move to a custom domain (e.g. `vocab.<owned-domain>`). Custom domains build reputation once at the parent-domain level; all subdomains inherit it, avoiding per-deployment whitelisting. See personal Obsidian note `Computer/Domain.md` for registrar/pricing options.
