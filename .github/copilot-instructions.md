# Copilot Instructions for nexfoody-web

## Project Overview
A React + TypeScript + Vite web app with Firebase authentication and Firestore data, built for a food ordering platform.
The repository contains two main flows:
- Multi-tenant store frontend under `src/pages/` and `src/components/`
- Platform / admin / vendor flows under `src/pages/nexfoody/`

It also preserves older original JS source copies in `src/pages_acai_orig/` and `src/components_acai_orig/`.

## How to run
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`

There is no dedicated test script in `package.json`.

## Key files and directories
- `src/App.tsx` — main router, auth guards, multi-tenant layout, and domain slug handling.
- `src/contexts/AuthContext.tsx` — Firebase auth state, user document syncing, login/register flows.
- `src/contexts/TenantContext.tsx` — tenant resolver and configuration loader from Firestore.
- `src/lib/firebase.ts` — Firebase initialization.
- `src/pages/` — main app pages.
- `src/components/` — shared UI components.
- `src/pages/acai-puro-gosto/` — store-specific page variants for the Açaí Puro Gosto tenant.
- `src/pages/nexfoody/` — Nexfoody vendor / platform pages.
- `src/components_acai_orig/` and `src/pages_acai_orig/` — legacy/original source copies, avoid editing unless migrating.

## Architecture notes
- The app uses React Router v6 with nested routing.
- Authentication is handled by Firebase Auth and Firestore user documents.
- `ProtectedRoute` and `AdminRoute` wrappers gate private and admin-only pages.
- `TenantProvider` resolves store config by slug and exposes tenant metadata.
- Tenant flow uses `/loja/:slug` routes.
- Nexfoody platform routes use paths like `/nexfoody/*`, `/login`, `/cadastro`, `/mapa`, `/landing`.
- `src/App.tsx` also records analytics to Firestore on visit and online status.

## Conventions
- Prefer TypeScript for new files, but maintain compatibility with existing `.jsx` pages.
- Keep page/component structure aligned with existing directories.
- Reuse `TenantProvider`, `AuthProvider`, and route wrapper patterns when adding features.
- Use `src/pages/` for core app pages, `src/pages/nexfoody/` for platform/vendor-specific flows.
- Avoid duplication of logic across legacy `*_orig` folders unless performing a deliberate migration.

## Common terms
- `loja` — store
- `pontos` — points
- `cliente` — customer
- `lojista` — store owner/vendor
- `admin` — admin user
- `tenant` — multi-tenant store configuration

## When editing
- Preserve existing route structure and navigation behavior.
- If adding a new feature, place it in the corresponding page or component folder, not in legacy `_orig` folders.
- Keep Firebase reads/writes consistent with the existing Firestore patterns.
- Do not change build/lint scripts unless necessary for a dependency or toolchain update.

## Example prompts
- "Add a new tenant-specific page under `/loja/:slug/contato` that reads store contact info from Firestore."
- "Refactor `src/contexts/AuthContext.tsx` so Google sign-in uses `signInWithRedirect` instead of popup."
- "Migrate `src/pages/Cardapio.jsx` to TypeScript and update it to use `useTenant()` from `TenantContext`."
- "Implement a new Firebase analytics helper in `src/lib/analytics.ts` and replace the inline tracking code in `src/App.tsx`."
