# Nginx Configuration for VPS Deployment

These Nginx configurations are for **VPS deployment only**. They are not used in local development.

## Files

- `ATls.city.conf` - Main application (web-directory service on port 3008)
- `lists.fema.monster.conf` - AT Protocol proxy (on port 3010)

## Setup on VPS

### 1. Install Nginx
```bash
sudo apt update
sudo apt install nginx -y
```

### 2. Copy Configuration Files
```bash
cd /opt/skymap
sudo cp nginx/*.conf /etc/nginx/sites-available/
```

### 3. Enable Sites
```bash
sudo ln -s /etc/nginx/sites-available/ATls.city.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/lists.fema.monster.conf /etc/nginx/sites-enabled/
```

### 4. Test Configuration
```bash
sudo nginx -t
```

### 5. Reload Nginx
```bash
sudo systemctl reload nginx
```

### 6. Set Up SSL (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificates (this will automatically update nginx configs)
sudo certbot --nginx -d ATls.city -d www.ATls.city
sudo certbot --nginx -d lists.fema.monster
```

### 7. Verify Auto-Renewal
```bash
sudo certbot renew --dry-run
```

## Local Development

**These files are NOT used locally.** In local development:
- Access services directly: `http://localhost:3008`, `http://localhost:3010`
- No Nginx needed
- No SSL needed

## Notes

- Nginx runs on the **host system**, not in Docker
- Services still run in Docker on their normal ports
- Nginx just proxies external traffic to the Docker services
- SSL certificates are managed by Certbot and stored on the host
