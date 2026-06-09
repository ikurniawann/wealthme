---
type: community
members: 10
---

# Audit Interceptor Logic

**Members:** 10 nodes

## Members
- [[.intercept()]] - code - apps/api/src/audit/audit.interceptor.ts
- [[ACTION_MAP]] - code - apps/api/src/audit/audit.interceptor.ts
- [[MUTATING_METHODS]] - code - apps/api/src/audit/audit.interceptor.ts
- [[SENSITIVE_KEYS]] - code - apps/api/src/audit/audit.interceptor.ts
- [[audit.interceptor.spec.ts]] - code - apps/api/src/audit/audit.interceptor.spec.ts
- [[audit.interceptor.ts]] - code - apps/api/src/audit/audit.interceptor.ts
- [[deriveEntity()]] - code - apps/api/src/audit/audit.interceptor.ts
- [[makeContext()]] - code - apps/api/src/audit/audit.interceptor.spec.ts
- [[mockAuditService]] - code - apps/api/src/audit/audit.interceptor.spec.ts
- [[sanitize()]] - code - apps/api/src/audit/audit.interceptor.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Audit_Interceptor_Logic
SORT file.name ASC
```

## Connections to other communities
- 5 edges to [[_COMMUNITY_NestJS Module Registry]]
- 2 edges to [[_COMMUNITY_Audit Logging Service]]

## Top bridge nodes
- [[audit.interceptor.ts]] - degree 11, connects to 2 communities
- [[audit.interceptor.spec.ts]] - degree 4, connects to 1 community
- [[.intercept()]] - degree 3, connects to 1 community