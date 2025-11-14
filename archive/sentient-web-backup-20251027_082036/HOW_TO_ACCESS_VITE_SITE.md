# 🚨 IMPORTANT: How to Access the NEW Vite Site

## The Problem:
You're probably looking at the **OLD Next.js site** instead of the **NEW Vite site**!

---

## Which Site Are You Looking At?

### ❌ OLD Next.js Site (DON'T USE THIS):
- **URL**: https://192.168.20.3 (HTTPS, port 443)
- **OR**: http://192.168.20.3:3001
- **Status**: OLD - has caching issues
- **How to tell**: Check browser address bar

### ✅ NEW Vite Site (USE THIS):
- **URL**: **http://192.168.20.3:3002** (HTTP, port 3002)
- **Status**: NEW - fully migrated, no caching issues
- **How to tell**: Check browser address bar, should show **:3002**

---

## How to Access the NEW Vite Site:

### Step 1: Open a NEW Browser Tab/Window

### Step 2: Type This EXACT URL:
```
http://192.168.20.3:3002
```

**Important**:
- Use **HTTP** (not HTTPS)
- Include **:3002** at the end
- Don't let browser auto-complete to the old site

### Step 3: Verify You're on the Vite Site
Look at the browser address bar - it should show:
```
http://192.168.20.3:3002/login
```
or
```
http://192.168.20.3:3002/dashboard
```

The **:3002** tells you you're on the Vite site!

---

## Quick Visual Check:

### Both sites look similar because they have the same neural AI theme!

But the Vite site should:
- ✅ Load **INSTANTLY** after login
- ✅ Rooms button **WORKS** and navigates to rooms list
- ✅ All navigation **INSTANT** (no delays)
- ✅ Changes appear **IMMEDIATELY** when editing code

The Next.js site:
- ❌ Has **DELAYS** when navigating
- ❌ Rooms button might not work
- ❌ Slower to load pages
- ❌ Has caching issues

---

## Still Not Sure?

### Test 1: Check Browser DevTools Console
1. Press F12 to open DevTools
2. Go to Console tab
3. Look for Vite messages (on Vite site you'll see HMR messages)

### Test 2: Check Network Tab URL
1. Press F12 to open DevTools
2. Go to Network tab
3. Check the requests - they should be going to `:3002`

### Test 3: Hard Refresh
1. Make sure you're at `http://192.168.20.3:3002`
2. Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
3. Login again

---

## Routes Fixed:

The routes now match DashboardLayout correctly:

- `/login` → Login page
- `/dashboard` → Dashboard home
- `/dashboard/rooms` → **Rooms list** (Rooms button goes here)
- `/dashboard/rooms/:roomId` → Room detail
- `/dashboard/rooms/:roomId/scenes` → Scenes list
- `/dashboard/rooms/:roomId/scenes/:sceneId/timeline` → **Timeline Editor**
- `/dashboard/devices` → Devices list

---

## Testing the Rooms Button:

### After accessing http://192.168.20.3:3002 and logging in:

1. You should see the Dashboard
2. Look at the sidebar on the left
3. Click **"Rooms"** button
4. You should navigate to `/dashboard/rooms`
5. You should see the rooms list

If this doesn't work, you're probably still on the old Next.js site!

---

## Final Checklist:

- [ ] I opened a NEW browser tab
- [ ] I typed `http://192.168.20.3:3002` in the address bar
- [ ] The URL shows `:3002` after I navigate
- [ ] I'm not being redirected to HTTPS or port 443
- [ ] The site loads instantly
- [ ] The Rooms button works

If all checkboxes are checked, you're on the Vite site! 🎉

---

## Still Having Issues?

### Clear Browser Cache:
1. Press Ctrl+Shift+Delete (Windows/Linux) or Cmd+Shift+Delete (Mac)
2. Select "Cached images and files"
3. Click "Clear data"
4. Close browser completely
5. Open new browser window
6. Go to `http://192.168.20.3:3002`

### Use Incognito/Private Mode:
1. Open incognito/private window
2. Go to `http://192.168.20.3:3002`
3. Login and test

---

**Remember: The Vite site is on PORT 3002!**

http://192.168.20.3:**3002** ← This is the new site!
