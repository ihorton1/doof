<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Prisma runs engine-free (driver adapter)

This repo runs on Windows arm64, where Prisma 6.x ships no `windows-arm64` query engine. Prisma is configured in engine-free mode:

- `prisma/schema.prisma` generator: `engineType = "client"` (no native query engine is generated/required)
- `src/lib/prisma.ts` instantiates `PrismaClient` with a `PrismaPg` adapter from `@prisma/adapter-pg` using `DATABASE_URL`
- `package.json` has `postinstall: prisma generate` so the client is regenerated after every install

Do not re-add `binaryTargets`, switch back to `engine: "classic"` in `prisma.config.ts`, or remove the adapter — doing so will break local dev on arm64 Windows with `PrismaClientInitializationError: Could not locate the Query Engine for runtime "windows"`.

# lightningcss native binary

`lightningcss-win32-arm64-msvc` is pinned as an optional dep so Tailwind v4 / PostCSS works on arm64 Windows. If you see `Cannot find module '../lightningcss.win32-arm64-msvc.node'`, run `npm install` (the optional dep should pull it in).
