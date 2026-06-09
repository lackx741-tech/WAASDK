#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# IntegratedDEX WaaS Platform — One-Command Server Setup
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh yourdomain.com
#
# What this does:
#   1. Installs Docker + Docker Compose (if missing)
#   2. Configures Nginx with your domain
#   3. Gets SSL certificate from Let's Encrypt
#   4. Starts all services
#   5. Creates your admin account
# ══════════════════════════════════════════════════════════════════════════════

set -e

DOMAIN=${1:-""}
EMAIL=${2:-"admin@$DOMAIN"}

# ── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
header() { echo -e "\n${BLUE}══════════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}══════════════════════════════════════════${NC}\n"; }

# ── Check domain argument ──────────────────────────────────────────────────────
if [ -z "$DOMAIN" ]; then
  error "Usage: ./setup.sh yourdomain.com [email]"
fi

header "IntegratedDEX WaaS Platform Setup"
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# ── 1. Install Docker ──────────────────────────────────────────────────────────
header "Step 1: Docker"

if command -v docker &> /dev/null; then
  log "Docker already installed: $(docker --version)"
else
  warn "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  log "Docker installed"
fi

if command -v docker compose &> /dev/null; then
  log "Docker Compose available"
else
  error "Docker Compose not found. Install Docker Engine 20.10+ which includes Compose v2."
fi

# ── 2. Configure environment ───────────────────────────────────────────────────
header "Step 2: Environment"

if [ ! -f .env ]; then
  cp .env.example .env
  # Generate random secrets
  API_KEY=$(openssl rand -hex 24)
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s/CHANGE_ME_TO_A_RANDOM_STRING/$API_KEY/" .env
  sed -i "s/CHANGE_ME_TO_A_LONG_RANDOM_STRING_AT_LEAST_32_CHARS/$JWT_SECRET/" .env
  sed -i "s/https:\/\/yourdomain.com/https:\/\/$DOMAIN/" .env
  log ".env created with generated secrets"
  warn "Edit .env to add Telegram tokens and sponsor key if needed: nano .env"
else
  log ".env already exists, keeping it"
fi

# ── 3. Configure Nginx ─────────────────────────────────────────────────────────
header "Step 3: Nginx Configuration"

sed -i "s/DOMAIN/$DOMAIN/g" nginx.conf
log "Nginx configured for $DOMAIN"

# ── 4. SSL Certificate ─────────────────────────────────────────────────────────
header "Step 4: SSL Certificate"

mkdir -p ssl certbot-webroot

# First, start nginx with a temporary self-signed cert for the certbot challenge
if [ ! -f ssl/live/$DOMAIN/fullchain.pem ]; then
  warn "Getting SSL certificate from Let's Encrypt..."

  # Create temp self-signed cert so nginx can start
  mkdir -p ssl/live/$DOMAIN
  openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout ssl/live/$DOMAIN/privkey.pem \
    -out ssl/live/$DOMAIN/fullchain.pem \
    -subj "/CN=$DOMAIN" 2>/dev/null

  # Start nginx with temp cert
  docker compose up -d nginx
  sleep 3

  # Get real cert
  docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

  # Restart nginx with real cert
  docker compose restart nginx
  log "SSL certificate obtained for $DOMAIN"
else
  log "SSL certificate already exists"
fi

# ── 5. Start all services ──────────────────────────────────────────────────────
header "Step 5: Starting Services"

docker compose up -d --build
sleep 5

# Check health
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
  log "API is healthy"
else
  warn "API may still be starting up..."
fi

# ── 6. Create admin account ────────────────────────────────────────────────────
header "Step 6: Admin Account"

ADMIN_EMAIL="admin@$DOMAIN"
ADMIN_PASS=$(openssl rand -base64 12)

RESULT=$(curl -sf -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\",\"name\":\"Admin\"}" 2>/dev/null || echo "FAILED")

if echo "$RESULT" | grep -q "token"; then
  log "Admin account created"
  echo ""
  echo -e "  ${GREEN}Email:${NC}    $ADMIN_EMAIL"
  echo -e "  ${GREEN}Password:${NC} $ADMIN_PASS"
  echo ""
  warn "⚠️  Save these credentials! They won't be shown again."
else
  warn "Admin account may already exist or API not ready yet"
fi

# ── Done ───────────────────────────────────────────────────────────────────────
header "🚀 Deployment Complete!"

echo -e "Your WaaS platform is live at:"
echo ""
echo -e "  ${GREEN}Landing:${NC}  https://$DOMAIN"
echo -e "  ${GREEN}Console:${NC}  https://$DOMAIN/console/"
echo -e "  ${GREEN}API:${NC}      https://$DOMAIN/api/health"
echo ""
echo -e "Commands:"
echo -e "  ${BLUE}docker compose logs -f api${NC}     — View API logs"
echo -e "  ${BLUE}docker compose restart${NC}         — Restart all services"
echo -e "  ${BLUE}docker compose down${NC}            — Stop everything"
echo -e "  ${BLUE}docker compose up -d --build${NC}   — Rebuild & restart"
echo ""
echo -e "Edit configuration: ${YELLOW}nano .env${NC}"
echo ""
