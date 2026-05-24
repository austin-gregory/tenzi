#!/bin/bash

# Tenzi Game Deployment Script
# Usage: ./deploy.sh <VPS_IP_OR_HOST> <SSH_USER> <DEPLOY_PATH>
# Example: ./deploy.sh 123.45.67.89 root /opt/tenzi

set -e

if [ $# -lt 3 ]; then
  echo "Usage: ./deploy.sh <VPS_IP_OR_HOST> <SSH_USER> <DEPLOY_PATH>"
  echo "Example: ./deploy.sh 123.45.67.89 root /opt/tenzi"
  exit 1
fi

VPS_HOST=$1
SSH_USER=$2
DEPLOY_PATH=$3
DOMAIN="tenzi.darkgamefactory.com"

echo "🚀 Deploying Tenzi Game"
echo "   VPS: $VPS_HOST"
echo "   User: $SSH_USER"
echo "   Path: $DEPLOY_PATH"
echo "   Domain: $DOMAIN"
echo ""

# Deploy via SSH
ssh -o StrictHostKeyChecking=no "$SSH_USER@$VPS_HOST" << 'REMOTE_COMMANDS'
# Ensure deploy directory exists
mkdir -p $DEPLOY_PATH
cd $DEPLOY_PATH

# If this is the first deployment, clone the repo
if [ ! -d ".git" ]; then
  echo "First deployment - cloning repository..."
  cd ..
  git clone https://github.com/austin-gregory/tenzi.git tenzi-temp
  cd tenzi-temp
  mv .git ../.git-temp
  cd ..
  rm -rf tenzi-temp
  mkdir -p tenzi
  mv .git-temp tenzi/.git
  cd tenzi
  git config --local user.email "deploy@tenzi.local"
  git config --local user.name "Deployment"
  git fetch origin main:main
  git checkout main
else
  echo "Updating existing deployment..."
  cd $DEPLOY_PATH
  git fetch origin
  git reset --hard origin/main
fi

echo "Building and deploying with Docker Compose..."
docker-compose down 2>/dev/null || true
docker-compose build --no-cache
docker-compose up -d

echo "Waiting for services to start..."
sleep 10

echo "✅ Deployment complete!"
echo "   Server: http://$DOMAIN:3010"
echo "   Client: http://$DOMAIN"
REMOTE_COMMANDS

echo ""
echo "✅ Deployment script executed successfully!"
echo ""
echo "Next steps:"
echo "1. If you haven't set up Nginx reverse proxy, run: ssh $SSH_USER@$VPS_HOST"
echo "2. Configure Nginx for $DOMAIN (see nginx-setup.sh)"
echo "3. Set up SSL with Let's Encrypt"
