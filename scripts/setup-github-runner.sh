#!/bin/bash
# Setup GitHub Actions Self-Hosted Runner on Production Server
# Run this script on techadmin@192.168.2.3

set -e

REPO_OWNER="AaronLay10"
REPO_NAME="sentient"
RUNNER_NAME="sentient-production"
RUNNER_LABELS="self-hosted,production,sentient"
WORK_DIR="/opt/sentient-runner"

echo "🔧 Setting up GitHub Actions Self-Hosted Runner"
echo "================================================"

# Create runner directory
sudo mkdir -p "$WORK_DIR"
sudo chown techadmin:techadmin "$WORK_DIR"
cd "$WORK_DIR"

# Download latest runner
echo "📥 Downloading GitHub Actions runner..."
RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | grep -oP '"tag_name": "v\K(.*)(?=")')
curl -o actions-runner-linux-x64.tar.gz -L "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

# Extract runner
echo "📦 Extracting runner..."
tar xzf ./actions-runner-linux-x64.tar.gz
rm actions-runner-linux-x64.tar.gz

# Configure runner (requires GitHub Personal Access Token)
echo ""
echo "⚠️  IMPORTANT: You need a GitHub Personal Access Token with 'repo' and 'admin:org' scopes"
echo "   Create one at: https://github.com/settings/tokens/new"
echo ""
read -p "Enter your GitHub Personal Access Token: " GITHUB_TOKEN

# Generate runner token
echo "🔑 Generating runner registration token..."
RUNNER_TOKEN=$(curl -X POST \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runners/registration-token" \
  | grep -oP '"token": "\K[^"]+')

if [ -z "$RUNNER_TOKEN" ]; then
  echo "❌ Failed to generate runner token. Check your GitHub token permissions."
  exit 1
fi

# Configure runner
echo "⚙️  Configuring runner..."
./config.sh \
  --url "https://github.com/${REPO_OWNER}/${REPO_NAME}" \
  --token "${RUNNER_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${RUNNER_LABELS}" \
  --work "_work" \
  --unattended \
  --replace

# Install as systemd service
echo "🔧 Installing runner as systemd service..."
sudo ./svc.sh install techadmin
sudo ./svc.sh start

# Check status
echo ""
echo "✅ Runner installed and started!"
echo ""
sudo ./svc.sh status

echo ""
echo "================================================"
echo "🎉 Setup Complete!"
echo ""
echo "Runner Details:"
echo "  Name: ${RUNNER_NAME}"
echo "  Labels: ${RUNNER_LABELS}"
echo "  Work Directory: ${WORK_DIR}"
echo ""
echo "Verify in GitHub:"
echo "  https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/actions/runners"
echo ""
echo "Useful Commands:"
echo "  sudo ./svc.sh status   - Check runner status"
echo "  sudo ./svc.sh stop     - Stop runner"
echo "  sudo ./svc.sh start    - Start runner"
echo "  ./config.sh remove     - Remove runner"
echo ""
