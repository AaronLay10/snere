# Sentient Engine

**Escape room orchestration platform** used here as a local development environment for a single web application.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.1-61DAFB)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://www.docker.com/)

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/AaronLay10/sentient.git
cd sentient
npm install

# Start local environment for the web app
npm run dev
```

**Login:** `admin@paragon.local` / `password`

**📖 New to the project?** Read [Developer Onboarding Guide](./docs/DEVELOPER_ONBOARDING.md)

## 📋 What's Included

### Application Overview

- **Sentient Web** - React 19 + Vite frontend
- **Sentient API** - TypeScript/Express REST API used by the web app

## 🏗️ Architecture (Local Dev)

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │─────▶│  Sentient    │─────▶│   MQTT      │
│  React 19   │      │  API Service │      │   Broker    │
└─────────────┘      └──────────────┘      └─────────────┘
                            │                      │
                            ▼                      ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │   Database   │
                    └──────────────┘
```

**Key Principles (for this workspace):**

- **snake_case everywhere** - Database and API consistency
- **Type-safe** - TypeScript across backend and frontend

## 🛠️ Development

### Project Structure

```
sentient/
├── services/                    # Application services used by the web app
│   ├── api/                    # REST API (TypeScript/Express)
│   └── sentient-web/           # Frontend (React 19 + Vite)
├── scripts/                     # Local development scripts
├── docs/                        # Documentation for this workspace
└── .vscode/                     # VS Code configuration
```

### Available Commands

```bash
# Development
npm run dev              # Start the local web app stack

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Code Quality
npm run lint             # Lint all code
npm run lint:fix         # Auto-fix issues
npm run format           # Format all files
npm run type-check       # TypeScript check

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed test data
npm run db:reset         # Reset database

# Building
npm run build            # Build all services
```

## 🧪 Testing

### Running Tests

```bash
# All tests
npm test

# Specific service
cd services/api && npm test
cd services/sentient-web && npm test

# Watch mode
npm run test:watch

# Coverage
npm test -- --coverage
```

### Writing Tests

**Unit Test:**

```typescript
describe('hashPassword', () => {
  it('should hash a password', async () => {
    const hash = await hashPassword('test123');
    expect(hash).toBeDefined();
    expect(hash).not.toBe('test123');
  });
});
```

**Integration Test:**

```typescript
describe('POST /api/auth/login', () => {
  it('should return token for valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@paragon.local', password: 'password' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
```

## 🐛 Debugging

### VS Code Debugging

1. Press `F5` or use Debug panel
2. Select "Attach to All Services"
3. Set breakpoints in TypeScript files
4. Debug with hot-reload support

Debug ports:

- API: 9229
- Executor Engine: 9231
- Device Monitor: 9232

### View Logs

Use your usual Node/React logging and any local terminal output from `npm run dev`.

## 🌐 Access Points

- **Frontend:** http://localhost:3002
- **API:** http://localhost:3000

## 🔐 Security

Even in local development, follow good practices:

- Use parameterized queries for database access
- Keep JWT and other secrets in local `.env` files (not committed)

## 🔧 Troubleshooting

### Common Issues

- **Port already in use:** find and stop the process on that port.
- **Hot reload not working:** ensure `npm run dev` is running and files are saved.

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) for:

- Development workflow
- Code standards (snake_case everywhere!)
- Testing requirements (80% coverage for critical paths)
- Commit message format
- Pull request process

## 📚 Documentation

- **[Developer Onboarding](./docs/DEVELOPER_ONBOARDING.md)** - Get started in 30 minutes
- **[Contributing Guide](./CONTRIBUTING.md)** - Development workflow and standards
- **[System Architecture](./SYSTEM_ARCHITECTURE.md)** - Architecture reference for this app
- **[Copilot Instructions](./.github/copilot-instructions.md)** - Quick reference

## 📊 Tech Stack

**Backend:**

- Node.js 22 + TypeScript 5.9
- Express 4.18
- PostgreSQL 16
- MQTT 5

**Frontend:**

- React 19.1
- Vite 5.4
- TypeScript 5.9
- Tailwind CSS 3.4
- Zustand (state management)
- Socket.IO (real-time)

**Hardware:**

- Teensy 4.1 microcontrollers
- Arduino framework
- MQTT client library
- Auto-registration system

**Infrastructure:**

- Docker + Docker Compose
- Prometheus + Grafana
- Loki + Promtail
- Nginx reverse proxy

## 📝 License

This project is UNLICENSED - proprietary software for Sentient Engine.

## 🆘 Support

- **Documentation:** Check `/docs` directory
- **Issues:** Open a GitHub issue
- **Questions:** Contact development team

---

**Built with ❤️ for the future of immersive entertainment**

**Version:** 2.1.0
**Last Updated:** January 14, 2025
