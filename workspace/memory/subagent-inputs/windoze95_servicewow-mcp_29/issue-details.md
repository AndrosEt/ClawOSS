# Issue #29: Security: ServiceNow Query Injection in `change_update_set` tool

## What
In `src/tools/updateSets.ts` (lines 48-50), user-provided `args.identifier` is concatenated directly into `encodedQuery` without sanitization when it is not a 32-character `sys_id`.

## Vulnerability
An attacker can inject `^` characters to override logic, bypass `state=in progress` filter, or execute arbitrary ServiceNow query on `sys_update_set`.

## Example Attack
`identifier: MySet^state=closed` bypasses the intended filter.

## Suggested Fix
Use `sanitizeValue(args.identifier)` from `src/servicenow/queryBuilder.ts`:

```typescript
import { sanitizeValue } from "../servicenow/queryBuilder.js";

const encodedQuery = isSysId
  ? `sys_id=${args.identifier}^state=in progress`
  : `name=${sanitizeValue(args.identifier)}^state=in progress^ORDERBYDESCsys_updated_on`;
```

## Done When
- Import sanitizeValue from queryBuilder
- Use it when constructing encodedQuery with identifier
- PR submitted
