---
name: Multi-admin access policy
description: The crochet admin area is restricted to configured Clerk primary emails.
---
Admin access is fail-closed: the signed-in Clerk user's primary email must match one of the emails in the CROCHET_ADMIN_EMAILS comma-separated list. Unknown accounts receive a 403 and are signed out by the client.

**Why:** This is a personal catalog, so account creation alone must never grant management access.

**How to apply:** Keep the allowlist in workspace secrets and enforce it on both admin UI access checks and every server-side mutation or upload.

**Supported emails:**
- michacullamat@gmail.com
- mickaelcullamat01@gmail.com