# Hosting

Everything runs on the company server (Proxmox VM 105) at
**https://sme.knoxvilletechnologies.com**. There is no Vercel, Render or Supabase.

| Part | Where |
| --- | --- |
| Code | `/opt/business-sme` (a clone of this repository) |
| Web app | `frontend/dist`, served by Nginx (site `business-sme`) |
| API | NestJS on `127.0.0.1:4100`, systemd service `business-sme`, proxied at `/api` |
| Database | PostgreSQL on the same VM, database `kenya_sme` |
| Settings | `backend/.env` (see `env.production.example`) |
| Android app | Opens https://sme.knoxvilletechnologies.com (`frontend/capacitor.config.ts`) |

## Updating the server

After changes are pushed to `main`, on the server:

```bash
cd /opt/business-sme && sudo -u postgres pg_dump -Fc kenya_sme > ~/before-update.dump && git pull && npm ci && npm run build && sudo systemctl restart business-sme
```

This backs up the database, pulls, installs, builds the web app and API, and
restarts the API. Nginx serves the new web app straight away.

## Checking it

```bash
sudo systemctl status business-sme      # API running?
sudo journalctl -u business-sme -n 100  # API logs
sudo nginx -t && sudo systemctl reload nginx
```
