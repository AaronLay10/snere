# GitHub Self-Hosted Runner Setup Instructions

## Step 1: Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens/new
2. Name: `Sentient Runner Registration`
3. Scopes: Check **`repo`** (full control of private repositories)
4. Click "Generate token"
5. **COPY THE TOKEN** - you'll need it in the next step

## Step 2: SSH to Production Server

```bash
ssh techadmin@192.168.2.3
```

## Step 3: Run Setup Script

```bash
cd /tmp
chmod +x setup-github-runner.sh
./setup-github-runner.sh
```

The script will:

- Download the GitHub Actions runner
- Ask for your Personal Access Token (paste the token from Step 1)
- Register the runner with your repository
- Install it as a systemd service

## Step 4: Verify Runner is Active

After the script completes, verify in GitHub:

- Go to: https://github.com/AaronLay10/sentient/settings/actions/runners
- You should see **"sentient-production"** with a green dot (Idle/Active)

## Step 5: Test Deployment

Push a commit to trigger the workflow:

```bash
# On your Mac
cd ~/Development/sentientengine.ai
echo "# Test" >> README.md
git add README.md
git commit -m "test: trigger self-hosted runner deployment"
git push origin main
```

Watch the workflow:

- Go to: https://github.com/AaronLay10/sentient/actions
- The "Build and Push Docker Images" workflow should run
- The "Deploy to Production" job should run on your self-hosted runner

## Troubleshooting

### Check runner status on server:

```bash
ssh techadmin@192.168.2.3
cd /opt/sentient-runner
sudo ./svc.sh status
```

### View runner logs:

```bash
journalctl -u actions.runner.AaronLay10-sentient.sentient-production.service -f
```

### Restart runner:

```bash
sudo ./svc.sh restart
```

### Remove and re-register:

```bash
cd /opt/sentient-runner
./config.sh remove --token YOUR_TOKEN
./setup-github-runner.sh  # Run setup again
```

## Security Notes

- Runner runs as `techadmin` user
- Only responds to jobs from your repository
- Polls GitHub (outbound), no inbound ports required
- Starts automatically on server boot
