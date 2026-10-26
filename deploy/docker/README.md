# Knoxville SME on a fresh VM (Docker + Caddy)

Everything runs in four containers on one Ubuntu VM: **db** (PostgreSQL 16), **api** (NestJS),
**web** (Caddy: the React app, automatic HTTPS and the `/api` proxy) and **backup** (nightly database dump).
This is separate from the older Nginx/systemd setup described in `deploy/README.md`.

## First install

1. **Get the code** (on the VM, as your normal user):
   ```bash
   git clone https://github.com/WatchDog386/knoxvile-sme.git ~/knoxvile-sme && cd ~/knoxvile-sme
   ```
2. **Prepare the VM** (Docker, firewall, fail2ban, swap, automatic security updates). Then log out and back in once:
   ```bash
   sudo bash deploy/docker/install.sh
   ```
3. **Create the settings** (asks for the web address and the admin e-mail/password; makes strong random secrets):
   ```bash
   cd ~/knoxvile-sme && bash deploy/docker/configure.sh
   ```
   Choose `ip` to test by IP address first, or press Enter for `sme.knoxvilletechnologies.com`.
4. **Build and start** (first build takes several minutes):
   ```bash
   bash deploy/docker/deploy.sh
   ```
5. **Sign in** with the admin e-mail and password you chose. The admin account and the business record are created on first start.

## Pointing the domain at this server

Make the DNS **A record** for the web address (e.g. `sme`) point at this VM's public IP, then:
```bash
bash deploy/docker/set-address.sh sme.knoxvilletechnologies.com
```
HTTPS is requested automatically (Let's Encrypt) once DNS resolves to this server.

## Updating after code changes

```bash
cd ~/knoxvile-sme && bash deploy/docker/deploy.sh
```
It takes a database backup first, pulls the latest code, rebuilds and restarts.

## Settings for M-Pesa, SMS, e-mail, WhatsApp and the AI assistant

```bash
bash deploy/docker/set-env.sh GEMINI_API_KEY      # typed hidden; restarts the services that need it
bash deploy/docker/set-env.sh MPESA_WEBHOOK_SECRET
```
`deploy/env.production.example` lists every setting and what it does. The M-Pesa paybill webhook URL is
`https://<your address>/api/v1/payments/mpesa/c2b`.

## Backups

The `backup` container writes `db_<date>.dump` into `deploy/docker/backups/` every night (14 days kept).
Restore with `bash deploy/docker/restore.sh deploy/docker/backups/db_….dump`.
To move data from another server: `pg_dump -Fc` there, copy the file here, then run `restore.sh` on it.

## Everyday commands

```bash
cd ~/knoxvile-sme/deploy/docker
docker compose --env-file .env ps                 # what is running
docker compose --env-file .env logs -f --tail=100 api
docker compose --env-file .env restart api
```
