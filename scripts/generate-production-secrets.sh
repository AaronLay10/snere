#!/bin/bash
# Generate secure secrets for production deployment

echo "🔐 Generating Production Secrets"
echo "=================================="
echo ""
echo "Copy these values to your production server's .env.production file:"
echo ""

echo "# Database"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')"
echo ""

echo "# MQTT Service Passwords"
echo "MQTT_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')"
echo "MQTT_EXECUTOR_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')"
echo "MQTT_MONITOR_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')"
echo ""

echo "# Security Secrets"
echo "JWT_SECRET=$(openssl rand -base64 32 | tr -d '/+=')"
echo "SESSION_SECRET=$(openssl rand -base64 32 | tr -d '/+=')"
echo ""

echo "=================================="
echo "⚠️  IMPORTANT:"
echo "1. Save these passwords somewhere secure (password manager)"
echo "2. Add them to /opt/sentient/.env.production on your server"
echo "3. Never commit .env.production to git"
echo "4. Update MQTT passwords in mosquitto-prod config too"
echo ""
