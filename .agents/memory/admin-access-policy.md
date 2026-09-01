---
name: Single-admin access policy
description: The crochet admin area is restricted to one configured Clerk primary email.
---
Admin access is fail-closed: the signed-in Clerk user's primary email must match the protected CROCHET_ADMIN_EMAIL secret. Unknown accounts receive a 403 and are signed out by the client.

**Why:** This is a personal catalog, so account creation alone must never grant management access.

**How to apply:** Keep the allowlist in workspace secrets and enforce it on both admin UI access checks and every server-side mutation or upload.