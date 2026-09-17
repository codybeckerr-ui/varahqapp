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

## Current first slice

`index.html` contains the approved VaraHQ marketing/login direction and is connected to the VaraHQ Supabase project for email/password sign-in. A minimal authenticated dashboard shell is included so auth can be tested immediately.

## Next

Convert the static first slice into the production Next.js app, verify authenticated organization/RLS access, add the Test Company owner, then build Templates → Template Builder → Generator.
