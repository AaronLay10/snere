# Complete Vite Frontend Migration Plan

## ✅ What's DONE:
1. **Vite Project Setup** - Complete with Tailwind CSS
2. **Neural AI Theme** - Custom cyberpunk color scheme, animations, particle effects
3. **API Client** - Full API with all endpoints (787 lines)
4. **Router Setup** - React Router v6 with protected routes
5. **Login Page** - Fully functional with neural animations
6. **Dashboard** - Working with rooms list
7. **Firewall Configuration** - Port 3002 open
8. **CORS Configuration** - Backend accepts requests from :3002

## 🎯 What's LEFT (Manual Migration Required):

### Critical Pages (1600+ lines each - too large for auto-migration):
1. **Timeline Editor** (`/rooms/:roomId/scenes/:sceneId/timeline`)
   - 1606 lines of complex code
   - THE MOST IMPORTANT PAGE (has the "Delay after Execution" field!)
   - Requires careful manual migration

2. **Rooms List** (`/rooms`)
3. **Room Detail** (`/rooms/:roomId`)
4. **Scenes List** (`/rooms/:roomId/scenes`)
5. **Devices List** (`/devices`)

## 🚀 Recommended Approach:

### Option 1: Test Current System First
- Test login and dashboard (already working)
- Verify neural theme and routing
- Confirm backend connectivity
- THEN migrate pages one by one

### Option 2: Copy-Paste Migration (Fastest)
For each page:
1. Copy page.tsx from Next.js
2. Replace `'use client'` with nothing
3. Replace `useRouter()` from next/navigation with `useNavigate()` from react-router-dom
4. Replace `useParams()` from next/navigation with `useParams()` from react-router-dom
5. Replace Link from next/link with Link from react-router-dom
6. Update imports to use `type` keyword for TypeScript types
7. Test!

### Option 3: Automated Script (Requires Testing)
I can create a sed/awk script to automate the conversions above, but it needs testing on one page first.

## 📋 Migration Checklist:

- [x] Project setup
- [x] Theme configuration
- [x] API client
- [x] Login page
- [x] Dashboard page
- [ ] Rooms list page
- [ ] Room detail page
- [ ] Scenes list page
- [ ] **Timeline editor (CRITICAL!)**
- [ ] Devices page
- [ ] Controllers page (if needed)

## 🔧 Quick Start to Continue Migration:

```bash
# Navigate to Vite project
cd /opt/sentient/services/sentient-web-vite

# The pages you need to create are in:
# src/pages/RoomsList.tsx
# src/pages/RoomDetail.tsx
# src/pages/ScenesList.tsx
# src/pages/TimelineEditor.tsx  <-- MOST IMPORTANT!
# src/pages/DevicesList.tsx

# Source pages are in:
# /opt/sentient/services/sentient-web/src/app/dashboard/rooms/page.tsx
# /opt/sentient/services/sentient-web/src/app/dashboard/rooms/[id]/page.tsx
# /opt/sentient/services/sentient-web/src/app/dashboard/rooms/[id]/scenes/page.tsx
# /opt/sentient/services/sentient-web/src/app/dashboard/rooms/[id]/scenes/[sceneId]/timeline/page.tsx
# /opt/sentient/services/sentient-web/src/app/dashboard/rooms/[id]/devices/page.tsx
```

## 💡 My Recommendation:

**Let me create STUB pages** right now so you can:
1. Test that routing works
2. See the neural theme on all pages
3. Verify navigation between pages
4. THEN we can migrate the complex Timeline editor carefully

The stub pages will show:
- Correct layout with neural theme
- Navigation works
- API connectivity works
- "Coming soon - migrating from Next.js" message

**Want me to create the stubs now?** This will give you a working system to test while we finish the migration!
