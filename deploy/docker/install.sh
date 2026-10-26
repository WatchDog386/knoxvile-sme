#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu 22.04/24.04 VM (e.g. on Proxmox) for Knoxville SME.
# Run once with sudo:   sudo bash deploy/docker/install.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo:  sudo bash deploy/docker/install.sh" >&2; exit 1; }
OWNER=${SUDO_USER:-}
[ -n "$OWNER" ] && [ "$OWNER" != root ] || { echo "Log in as your normal user and run it with sudo (not as root directly)." >&2; exit 1; }
ROOT=$(cd "$(dirname "$0")/../.." && pwd)

echo "▶ Updating system…"
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw fail2ban unattended-upgrades qemu-guest-agent

echo "▶ Enabling QEMU guest agent (lets Proxmox see the VM IP and shut it down cleanly)…"
systemctl enable --now qemu-guest-agent || true

echo "▶ Adding swap if RAM is small (building the app needs headroom)…"
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [ "$mem_kb" -lt 3800000 ] && ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "   4 GB swap enabled."
fi

echo "▶ Installing Docker…"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "▶ Letting $OWNER run Docker and own the project folder (no sudo needed afterwards)…"
usermod -aG docker "$OWNER"
chown -R "$OWNER":"$OWNER" "$ROOT"

echo "▶ Firewall: allow SSH, HTTP, HTTPS only…"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "▶ Automatic security updates + SSH brute-force protection…"
dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl enable --now fail2ban

echo
echo "✅ VM ready."
echo "   1. Log out and back in once (so the Docker permission applies)."
echo "   2. Then run:  bash deploy/docker/configure.sh"
