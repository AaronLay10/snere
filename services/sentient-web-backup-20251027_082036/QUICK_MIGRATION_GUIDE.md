# Quick Migration Guide - Next.js to Vite

## The Simple Truth

Each page needs these changes:

### 1. Remove (at top of file):
```tsx
'use client';
```

### 2. Change Imports:
```tsx
// OLD (Next.js):
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

// NEW (Vite):
import { useNavigate, useParams, Link } from 'react-router-dom';
```

### 3. Change Router Usage:
```tsx
// OLD:
const router = useRouter();
router.push('/path');
router.back();

// NEW:
const navigate = useNavigate();
navigate('/path');
navigate(-1);
```

### 4. Change Links:
```tsx
// OLD:
<Link href="/path">Text</Link>

// NEW:
<Link to="/path">Text</Link>
```

### 5. Type Imports:
```tsx
// OLD:
import { Room, Scene } from '@/lib/api';

// NEW:
import { type Room, type Scene } from '../lib/api';
```

### 6. Path Imports:
```tsx
// OLD (Next.js uses @ alias):
import { something } from '@/lib/api';
import Component from '@/components/Something';

// NEW (Vite uses relative paths):
import { something } from '../lib/api';
import Component from '../components/Something';
```

## That's It!

The actual page logic stays THE SAME. Just these import/routing changes.

## Auto-Convert Command:

```bash
# For any page file:
SOURCE="/opt/sentient/services/sentient-web/src/app/dashboard/PATH/page.tsx"
DEST="/opt/sentient/services/sentient-web-vite/src/pages/PageName.tsx"

cp "$SOURCE" "$DEST"
sed -i "/'use client'/d" "$DEST"
sed -i "s/from 'next\/navigation'/from 'react-router-dom'/g" "$DEST"
sed -i "s/import Link from 'next\/link'/import { Link } from 'react-router-dom'/g" "$DEST"
sed -i 's/const router = useRouter()/const navigate = useNavigate()/g' "$DEST"
sed -i 's/router\./navigate./g' "$DEST"
sed -i 's/navigate\.push/navigate/g' "$DEST"
sed -i 's/<Link href=/<Link to=/g' "$DEST"
sed -i "s/@\//.\.\//g" "$DEST"
```

Then fix any remaining type imports manually.
