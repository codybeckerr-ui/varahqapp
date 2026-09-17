# VaraHQ

**Brand Assets. Simplified.**

VaraHQ is a brand asset automation and brand compliance platform for distributed teams.

## Product flow

Design anywhere → Upload master → Configure approved variables → Test → Publish → Personalize → Generate.

## Production baseline

- Brand colors: Deep Green `#0F2D24`, Sage `#7A9B87`, Charcoal `#1F1F1F`, Stone `#E8E7E1`, White `#FFFFFF`
- Frontend direction: Next.js / React
- Auth + database: Supabase
- Rendering direction: Python / FastAPI
- Master artwork remains locked; variable rules are configured by admins and hidden from end users.
- Template fidelity rules include font, size, color, bounds, alignment, minimum font size, shrink-to-fit and overflow behavior.

## Current application slice

- `index.html` preserves the approved VaraHQ marketing and email/password sign-in direction.
- `signup.html` creates an Auth account and passes onboarding details to the database-controlled signup transaction.
- `app.html` protects the workspace and loads the signed-in user's profile, organization, role, and dashboard counts from Supabase.
- `supabase/migrations/` contains the reviewed database changes for secure organization onboarding and tenant-aware access.

The first person signing up for a new organization is assigned `owner` by the database trigger. Browser-supplied roles are never accepted. The existing Test Company is reserved for `Codybeckerr@gmail.com` so Cody's signup attaches to that record rather than creating a duplicate.

## Next

Verify the account-confirmation and authenticated organization flow in production, add the canonical logo asset when supplied, then build Templates → Template Builder → Generator and migrate deliberately to Next.js.
