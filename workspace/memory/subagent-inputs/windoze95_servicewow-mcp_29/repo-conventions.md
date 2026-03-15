# Repo Analysis: windoze95/servicewow-mcp

## Tech Stack
- **Language**: TypeScript
- **Framework**: Express with MCP (Model Context Protocol)
- **Build**: tsc

## Directory Structure
- `src/tools/updateSets.ts` - Target file with vulnerability
- `src/servicenow/queryBuilder.ts` - Contains sanitizeValue function

## Security Fix Required
File: `src/tools/updateSets.ts`, lines 48-50

Current (vulnerable):
```typescript
const encodedQuery = isSysId
  ? `sys_id=${args.identifier}^state=in progress`
  : `name=${args.identifier}^state=in progress^ORDERBYDESCsys_updated_on`;
```

Fix (sanitized):
```typescript
import { sanitizeValue } from "../servicenow/queryBuilder.js";

const encodedQuery = isSysId
  ? `sys_id=${args.identifier}^state=in progress`
  : `name=${sanitizeValue(args.identifier)}^state=in progress^ORDERBYDESCsys_updated_on`;
```

## Test Framework
- vitest (npm test)

## Verification
- Run tests to ensure no regressions
- Check sanitizeValue is properly imported and used
