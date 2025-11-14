# Developer Onboarding Guide

Welcome to the Sentient Engine workspace. This guide will get you up and running with the local development environment for the web application in under 30 minutes.

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] **macOS, Linux, or Windows** with WSL2
- [ ] **Node.js v22.0.0+** installed ([download](https://nodejs.org/))
- [ ] **Docker Desktop** installed and running ([download](https://www.docker.com/products/docker-desktop))
- [ ] **Git** configured with your GitHub account
- [ ] **VS Code** installed (recommended)
- [ ] **Terminal** access (Terminal.app, iTerm2, etc.)

## 🚀 Quick Start (Day 1)

### Step 1: Clone and Setup (5 minutes)

```bash
# Clone the repository
git clone https://github.com/AaronLay10/sentient.git
cd sentient

# Install all dependencies (workspace + all services)
npm install

# Copy environment configuration
cp services/api/.env.example services/api/.env
```

### Step 2: Start Local Development Environment (3 minutes)

```bash
# Start all local services in Docker
npm run dev

# This starts:
# - PostgreSQL database (port 5432)
# - MQTT broker (ports 1883/9001)
# - API service (port 3000)
# - Executor Engine (port 3001)
# - Device Monitor (port 3003)
# - Frontend (port 3002)
# - Prometheus, Grafana, Loki (monitoring)
```

**Wait for services to be healthy** (watch the terminal output from `npm run dev`).

### Step 3: Seed Local Development Data (1 minute)

```bash
# In a new terminal window
npm run db:seed

# This creates:
# - 2 test clients (Paragon Mesa, Test Client)
# - 3 test users (admin, gamemaster, editor) - password: "password"
# - 1 test room (The Clockwork Conspiracy)
# - 3 controllers, 3 devices, 3 scenes
```

### Step 4: Verify Everything Works Locally (2 minutes)

```bash
# Run health check
./scripts/health-check.sh

# Expected output:
# ✅ Database connection successful
# ✅ All services healthy
```

Open in your browser:

- **Frontend:** http://localhost:3002
- **API Health:** http://localhost:3000/api/health

### Step 5: Login and Explore the App (5 minutes)

1. Navigate to http://localhost:3002
2. Login with:
   - Email: `admin@paragon.local`
   - Password: `password`
3. Explore the interface:
   - View Clients
   - View Rooms (Clockwork)
   - View Controllers
   - View Devices

## 🛠️ VS Code Setup (10 minutes)

### Open Workspace

```bash
code .
```

### Install Recommended Extensions

When prompted, click "Install All" for recommended extensions:

- ESLint
- Prettier
- Docker
- PostgreSQL
- MQTT
- GitLens
- TypeScript

Or install manually from `.vscode/extensions.json`.

### Verify Configuration

1. Open any `.ts` file
2. Make a small change (add a space)
3. Save the file (Cmd+S / Ctrl+S)
4. **Verify:** File is auto-formatted by Prettier

### Test Debugging

1. Press `F5` or click "Run and Debug"
2. Select "Attach to All Services"
3. Open `services/api/src/routes/devices.ts`
4. Set a breakpoint (click left of line number)
5. Make an API request that hits that route
6. **Verify:** Debugger pauses at breakpoint

## 📚 Understanding the Architecture (15 minutes)

### Project Structure (Local Workspace)

```
sentient/
├── services/           # All microservices
│   ├── api/           # REST API (TypeScript/Express)
│   ├── executor-engine/  # Scene orchestration
│   ├── device-monitor/   # MQTT telemetry
│   └── sentient-web/     # Frontend (React 19)
├── hardware/          # Teensy firmware
├── config/            # Local Docker service configs
├── scripts/           # Development scripts
├── docs/              # Documentation
└── docker-compose.yml # Service orchestration
```

### Key Concepts

1. **snake_case everywhere** - Database and API use snake_case
2. **Multi-tenant ready** - Queries support `client_id` filtering, even in local dev
3. **MQTT topics** - Format: `client/room/category/controller/device/item` (when using hardware)

### Read These Next

- [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) - Complete architecture
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development guidelines
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) - Quick reference

## 🔨 Your First Task (30 minutes)

### Task: Add a Test Device

Let's add a new device to understand the flow:

1. **Add to database:**

   ```sql
   -- Connect to database
   docker exec -it sentient-postgres-1 psql -U sentient_dev -d sentient_dev

   -- Insert new device
   INSERT INTO devices (
     room_id, controller_id, device_id, friendly_name,
     device_type, device_category, mqtt_topic, emergency_stop_required, status
   ) VALUES (
     '10000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     'test_led',
     'Test LED Light',
     'led',
     'sensor',
     'paragon/clockwork/commands/boiler_room_subpanel/test_led',
     false,
     'active'
   );
   ```

2. **View in UI:**
   - Navigate to Clockwork room
   - Click "Devices"
   - **Verify:** Your new device appears

3. **Test API:**

   ```bash
   curl http://localhost:3000/api/sentient/devices
   ```

4. **Make a code change:**
   - Open `services/sentient-web/src/pages/DevicesPage.tsx`
   - Find the devices list rendering
   - Add a console.log to see device data
   - **Verify:** Hot-reload works, console shows data

### Success!

You've now:

- ✅ Set up your development environment
- ✅ Seeded test data
- ✅ Explored the UI
- ✅ Connected to the database
- ✅ Made your first code change

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run specific service tests
cd services/api && npm test
cd services/sentient-web && npm test

# Watch mode (runs on file changes)
npm run test:watch

# Coverage report
npm test -- --coverage
```

### Writing Your First Test

Create `services/api/src/__tests__/unit/example.test.ts`:

```typescript
describe('Example Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run it:

```bash
cd services/api && npm test -- example.test.ts
```

## 📝 Making Your First Contribution

### 1. Create a Feature Branch

```bash
git checkout -b feature/my-first-feature
```

### 2. Make Changes

- Edit code
- Add tests
- Update docs if needed

### 3. Test Everything

```bash
# Format code
npm run format

# Lint
npm run lint

# Test
npm test

# Build
npm run build
```

### 4. Commit and Push

```bash
git add .
git commit -m "feat(api): add my first feature"
git push origin feature/my-first-feature
```

### 5. Create Pull Request

- Go to GitHub
- Click "New Pull Request"
- Fill in description
- Request review

## 🔧 Common Development Tasks

### Restart Services

```bash
npm run dev:restart
```

### View Logs

```bash
# All services
npm run dev:logs

# Specific service (in another terminal)
docker logs -f sentient-api-1
```

### Reset Database

```bash
# ⚠️ Destroys all data!
npm run db:reset
```

### Database Migrations

```bash
# Create new migration
cd services/api && npm run migrate:create add_new_table

# Run migrations
npm run db:migrate
```

### Compile Teensy Firmware

```bash
# VS Code: Cmd+Shift+P → "Tasks: Run Task" → "Hardware: Compile Current Teensy"

# Or manually
cd hardware && ./compile_all.sh
```

## 🆘 Troubleshooting

### Services Won't Start

```bash
# Stop everything
docker compose down

# Clean up
docker system prune -f

# Restart
npm run dev:build
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View logs
docker logs sentient-postgres-1

# Restart database only
docker restart sentient-postgres-1
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)
```

### Hot Reload Not Working

1. Make sure you're running `npm run dev` (not `npm start`)
2. Check file is saved
3. Verify Docker volume mounts in `docker-compose.yml`
4. Restart the specific service

### TypeScript Errors

```bash
# Rebuild TypeScript
npm run build

# Check for type errors
npm run type-check
```

## 📖 Next Steps

Now that you're set up:

1. **Read the docs:**
   - [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md)
   - [CONTRIBUTING.md](../CONTRIBUTING.md)

2. **Explore the code:**
   - Start with `services/api/src/routes/`
   - Look at `services/sentient-web/src/pages/`

3. **Join development:**
   - Pick an issue from GitHub
   - Ask questions in team chat
   - Pair with experienced developers

## 🎉 Welcome to the Team!

You're now ready to build the next generation of Sentient Engine. Happy coding!

---

**Questions?** Open an issue or contact the development team.
