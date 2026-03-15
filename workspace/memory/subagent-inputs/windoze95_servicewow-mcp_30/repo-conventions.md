# Repo Analysis: windoze95/servicewow-mcp

## Tech Stack
- **Primary**: TypeScript/Node.js
- **Build**: tsc
- **Test**: Vitest
- **Runtime**: Node.js with Express

## Directory Structure
- `package.json` - Main manifest
- `package-lock.json` - Lock file (needs update)
- `src/` - Source code
- `tests/` - Test files

## Test Framework
- `npm test` - runs vitest
- `npm run test:coverage` - coverage report

## Scripts
- `npm run build` - compile TypeScript
- `npm run test` - run tests
- `npm run dev` - dev mode with tsx

## Security Fix Required
- `hono` is a transitive dependency (via @modelcontextprotocol/sdk)
- Current: hono ^4.11.4
- Need: hono >= 4.12.7
- Use `npm audit fix` to update

## PR Process
- No PR template found
- Standard GitHub workflow
- Ensure tests pass after update

## Verification
After update:
```bash
npm audit
npm test
```
