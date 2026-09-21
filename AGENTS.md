# Project rules
- Follow docs/PRD.md and the approved P0 scope.
- Never hardcode campus entities, categories or rating dimensions in page components.
- English UI and errors. Use generic typed components.
- Schema changes require migrations; preserve RLS and public identity redaction.
- Demo mode must never run in production. Do not add a runtime service-role client.
- Validate core behaviors with npm test, npm run typecheck and npm run build.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
