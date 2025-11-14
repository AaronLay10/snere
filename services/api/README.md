# Sentient Engine - REST API

Complete RESTful API for the Sentient Engine escape room control system.

## Features

- **JWT Authentication** - Secure token-based authentication
- **Role-Based Access Control (RBAC)** - 6 distinct user roles with fine-grained permissions
- **Audit Logging** - Complete tracking of all API actions
- **Multi-Tenant Architecture** - Client/tenant isolation
- **Dual Interface Support** - Sentient (admin) and Mythra (game master) interfaces
- **Rate Limiting** - Protection against abuse
- **Security Hardened** - Helmet middleware, CORS, input validation
- **PostgreSQL Database** - Robust relational data storage

## Quick Start

### 1. Install Dependencies

```bash
cd services/api
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

- `JWT_SECRET` - Generate a secure random string (32+ characters)
- `SESSION_SECRET` - Generate another secure random string
- `DB_PASSWORD` - Your PostgreSQL password
- `CORS_ORIGIN` - Your frontend URLs

To generate secure secrets:

```bash
openssl rand -hex 32
```

### 3. Setup Database

```bash
cd ../../database
./setup.sh
```

Follow the prompts to create the database and load seed data.

### 4. Start API Server (Local)

Development mode (with auto-reload):

```bash
npm run dev
```

The API will start on `http://localhost:3000` (or the PORT specified in .env).

### 5. Test API

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "sentient-api",
  "version": "1.0.0",
  "database": {
    "healthy": true
  }
}
```

## API Documentation

### Authentication

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123",
  "interface": "sentient"
}
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "username": "admin",
    "role": "admin",
    "clientId": "uuid",
    "clientName": "Paragon Escape Games"
  }
}
```

#### Get Current User

```http
GET /api/auth/me
Authorization: Bearer {token}
```

#### Change Password

```http
POST /api/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

#### Refresh Token

```http
POST /api/auth/refresh
Authorization: Bearer {token}
```

### Sentient Interface (Admin/Configuration)

All Sentient endpoints require authentication and appropriate permissions.

#### Clients

```http
GET /api/sentient/clients
GET /api/sentient/clients/:id
POST /api/sentient/clients
PUT /api/sentient/clients/:id
DELETE /api/sentient/clients/:id
```

#### Rooms

```http
GET /api/sentient/rooms
GET /api/sentient/rooms/:id
POST /api/sentient/rooms
PUT /api/sentient/rooms/:id
DELETE /api/sentient/rooms/:id
```

Query parameters:

- `clientId` - Filter by client
- `status` - Filter by status (draft, testing, active, maintenance, archived)

#### Scenes

```http
GET /api/sentient/scenes
GET /api/sentient/scenes/:id
POST /api/sentient/scenes
PUT /api/sentient/scenes/:id
DELETE /api/sentient/scenes/:id
```

Query parameters:

- `roomId` - Filter by room

#### Devices

```http
GET /api/sentient/devices
GET /api/sentient/devices/:id
POST /api/sentient/devices
PUT /api/sentient/devices/:id
DELETE /api/sentient/devices/:id
```

Query parameters:

- `roomId` - Filter by room
- `category` - Filter by device category
- `emergencyStopRequired` - Filter by emergency stop requirement (true/false)

#### Puzzles

```http
GET /api/sentient/puzzles
GET /api/sentient/puzzles/:id
POST /api/sentient/puzzles
PUT /api/sentient/puzzles/:id
DELETE /api/sentient/puzzles/:id
```

Query parameters:

- `roomId` - Filter by room

#### Users

```http
GET /api/sentient/users
GET /api/sentient/users/:id
POST /api/sentient/users
PUT /api/sentient/users/:id
DELETE /api/sentient/users/:id
```

Query parameters:

- `clientId` - Filter by client (admin only)
- `role` - Filter by role
- `active` - Filter by active status (true/false)

### Mythra Interface (Game Master Operations)

All Mythra endpoints require `game_master` or `admin` role.

#### List Available Rooms

```http
GET /api/mythra/rooms
Authorization: Bearer {token}
```

#### Get Room Status

```http
GET /api/mythra/rooms/:id/status
Authorization: Bearer {token}
```

Returns real-time room status including:

- Room details
- All scenes
- All devices
- Active game session (if any)

#### Emergency Stop

```http
POST /api/mythra/emergency-stop
Authorization: Bearer {token}
Content-Type: application/json

{
  "roomId": "uuid",
  "reason": "Safety concern"
}
```

#### Reset Room

```http
POST /api/mythra/reset-room
Authorization: Bearer {token}
Content-Type: application/json

{
  "roomId": "uuid",
  "reason": "New game session"
}
```

#### Send Hint

```http
POST /api/mythra/hint
Authorization: Bearer {token}
Content-Type: application/json

{
  "roomId": "uuid",
  "sceneId": "uuid",
  "hintText": "Check the clock on the wall"
}
```

### Audit Logs

#### Query Logs

```http
GET /api/audit/logs
Authorization: Bearer {token}
```

Query parameters:

- `userId` - Filter by user
- `actionType` - Filter by action type (login, create, update, delete, etc.)
- `resourceType` - Filter by resource type (clients, rooms, devices, etc.)
- `resourceId` - Filter by specific resource
- `startDate` - Filter by start date (ISO 8601)
- `endDate` - Filter by end date (ISO 8601)
- `success` - Filter by success status (true/false)
- `limit` - Number of results (default: 100)
- `offset` - Pagination offset (default: 0)

#### Get Statistics

```http
GET /api/audit/stats
Authorization: Bearer {token}
```

Query parameters:

- `startDate` - Filter by start date
- `endDate` - Filter by end date

#### Recent Logs

```http
GET /api/audit/recent
Authorization: Bearer {token}
```

Returns last 24 hours of activity.

#### User Audit Trail

```http
GET /api/audit/user/:userId
Authorization: Bearer {token}
```

#### Resource Audit Trail

```http
GET /api/audit/resource/:resourceType/:resourceId
Authorization: Bearer {token}
```

## User Roles

### 1. Admin

- **Level**: 100
- **Access**: All clients, all resources
- **Capabilities**: Full system access, user management, client management

### 2. Editor

- **Level**: 50
- **Access**: Own client only
- **Capabilities**: Read, write, manage devices/scenes/puzzles

### 3. Viewer

- **Level**: 30
- **Access**: Own client only
- **Capabilities**: Read-only access

### 4. Game Master

- **Level**: 40
- **Access**: Mythra interface, own client rooms
- **Capabilities**: Operational control, emergency stop, hints, room status

### 5. Creative Director

- **Level**: 45
- **Access**: Own client only
- **Capabilities**: Read, add comments, view analytics

### 6. Technician

- **Level**: 35
- **Access**: Own client only
- **Capabilities**: Read, test devices, view diagnostics

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

Common HTTP status codes:

- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

## Rate Limiting

Default rate limits:

- **Window**: 15 minutes (900,000 ms)
- **Max Requests**: 100 per window

Rate limit headers:

- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining in current window
- `X-RateLimit-Reset` - Time when rate limit resets

## Security

### CORS

CORS is configured via `CORS_ORIGIN` environment variable. Only specified origins can access the API.

### Helmet

Security headers are automatically applied:

- Content Security Policy
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options

### Password Requirements

- Minimum 8 characters
- Hashed with bcrypt (10 rounds by default)

### JWT Tokens

- Signed with `JWT_SECRET`
- Default expiration: 24 hours
- Include user ID, email, username, role, clientId

## Logging

Logs are written to:

- **Console**: Colored, human-readable format
- **File**: JSON format at `LOG_FILE` path

Log levels:

- `error` - Critical errors
- `warn` - Warnings
- `info` - General information
- `debug` - Debugging information

Set log level via `LOG_LEVEL` environment variable.

## Database Connection

The API uses a PostgreSQL connection pool:

- **Min connections**: 2
- **Max connections**: 10
- **Idle timeout**: 30 seconds
- **Connection timeout**: 10 seconds

## Development

### Run Tests

```bash
npm test
```

### Check Dependencies

```bash
npm audit
```

### Update Dependencies

```bash
npm update
```

## Running Locally

For this workspace, focus on running the API in local development mode (`npm run dev`) alongside the rest of the stack.

## Troubleshooting

### Database Connection Failed

Check PostgreSQL is running:

```bash
docker ps | grep postgres
# or
systemctl status postgresql
```

Verify credentials in `.env` match database.

### JWT Secret Not Set

Error: "FATAL: JWT_SECRET environment variable is not set"

Solution: Set `JWT_SECRET` in `.env` file.

### CORS Errors

Add your frontend URL to `CORS_ORIGIN` in `.env`:

```
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,https://yourfrontend.com
```

### Port Already in Use

Change `PORT` in `.env` or kill existing process:

```bash
lsof -ti:3000 | xargs kill -9
```

## Support

For issues or questions:

1. Check this README
2. Review API logs
3. Check database connection
4. Verify environment variables

---

**Version**: 1.0.0
**Last Updated**: 2025-10-14
