# SSL Certificate Configuration

## Production SSL Certificates (Let's Encrypt)

Place your SSL certificates in this directory:

- `fullchain.pem` - Full certificate chain
- `privkey.pem` - Private key

### Using Certbot with Docker

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate (standalone mode - nginx must be stopped)
sudo systemctl stop nginx
sudo certbot certonly --standalone -d sentientengine.ai -d www.sentientengine.ai
sudo systemctl start nginx

# Or using webroot mode (nginx running)
sudo certbot certonly --webroot -w /var/www/certbot \
  -d sentientengine.ai -d www.sentientengine.ai
```

### Copy Certificates to Docker Volume

```bash
# Create SSL directory
mkdir -p /opt/sentient/config/nginx/ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/sentientengine.ai/fullchain.pem /opt/sentient/config/nginx/ssl/
sudo cp /etc/letsencrypt/live/sentientengine.ai/privkey.pem /opt/sentient/config/nginx/ssl/

# Set permissions
sudo chmod 644 /opt/sentient/config/nginx/ssl/fullchain.pem
sudo chmod 600 /opt/sentient/config/nginx/ssl/privkey.pem
```

### Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Set up cron job for auto-renewal
sudo crontab -e

# Add this line (runs twice daily):
0 0,12 * * * certbot renew --quiet --post-hook "cp /etc/letsencrypt/live/sentientengine.ai/*.pem /opt/sentient/config/nginx/ssl/ && docker-compose -f /opt/sentient/docker-compose.yml restart nginx"
```

## Development/Testing (Self-Signed Certificate)

For local development, create a self-signed certificate:

```bash
# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /opt/sentient/config/nginx/ssl/privkey.pem \
  -out /opt/sentient/config/nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

## Certificate Permissions

```bash
# Set proper ownership and permissions
sudo chown root:root /opt/sentient/config/nginx/ssl/*.pem
sudo chmod 644 /opt/sentient/config/nginx/ssl/fullchain.pem
sudo chmod 600 /opt/sentient/config/nginx/ssl/privkey.pem
```

## Testing SSL Configuration

```bash
# Test nginx configuration
docker-compose exec nginx nginx -t

# Restart nginx to apply changes
docker-compose restart nginx

# Check SSL with OpenSSL
openssl s_client -connect sentientengine.ai:443 -servername sentientengine.ai

# Check SSL rating (after deploying)
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=sentientengine.ai
```