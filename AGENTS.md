<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Teaching and project documentation

- Explain each new backend concept before implementing it: its meaning, an ERP example, why it is needed, the proposed files and behavior, and how it will be verified. Wait until the user is ready before applying that lesson. Do not interpret a request for explanations as authorization to implement the next lesson.
- The user removed the in-app Learning Guide. Keep explanations and change notes in README.md or backend/API_GUIDE.md instead.
- In the same change, add a dated change-log entry explaining what changed, why, how it was verified, and any remaining limitations. Update the affected lessons, current status, commands, file guide, and working process as appropriate.
- Clearly distinguish completed functionality from proposals. Do not describe mock frontend data as database-backed or claim checks that were not run.
- Preserve readable formatting, indentation, and multiline JSX.
