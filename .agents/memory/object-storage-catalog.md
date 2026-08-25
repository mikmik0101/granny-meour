---
name: Catalog image storage
description: Persistent public product-image uploads for the crochet catalog.
---
Catalog photos use Replit Object Storage presigned uploads and are stored as object paths rather than image bytes or data URLs.

**Why:** Product photos must survive sessions and remain manageable without relying on third-party image URLs.

**How to apply:** Keep upload URL issuance authenticated, upload directly from the admin browser, and serve saved object paths through the API storage route.