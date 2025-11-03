# Mission Assignment Redesign Proposal

## Current Problems

1. **Incremental assignment**: Assigns missions one-by-one, failures leave partial state
2. **Local state tracking**: `missionCounts` Map can get out of sync with database
3. **Partial assignments**: Passphrase missions can have receivers without senders
4. **Complex loops**: Multiple nested loops with early exits
5. **No rollback**: Failed assignments leave database in inconsistent state

## Proposed Solution: Pre-Plan and Execute Atomically

### Approach 1: Single CTE Query (Best for PostgreSQL)

1. **Pre-plan all assignments** in JavaScript:
   - Load all available missions
   - Calculate which missions go to which users
   - Ensure each user gets exactly 3 missions
   - Ensure diversity (at least 2 different types)
   - Ensure no conflicts

2. **Execute using a single CTE query**:
   ```sql
   WITH assignment_plan AS (
     -- Pre-planned assignments as values
     SELECT * FROM (VALUES
       (1, 'book', 7, 1, 6),  -- book_id, user_red, user_blue
       (1, 'passphrase', 5, 2, 6, 12),  -- passphrase_id, receiver, sender1, sender2
       (1, 'object', 12),  -- object_id, agent
       -- ... more assignments
     ) AS t(user_id, mission_type, ...)
   )
   UPDATE missions SET assigned = ... FROM assignment_plan WHERE ...
   ```

### Approach 2: Stored Procedure (Most Robust)

Create a PostgreSQL function that:
1. Takes session user IDs as input
2. Unassigns all missions for those users
3. Calculates optimal assignments
4. Assigns all missions atomically
5. Returns success/failure

### Approach 3: Two-Phase Commit Pattern

1. **Phase 1**: Build assignment plan in a temporary table
2. **Phase 2**: Validate the plan (all users have exactly 3, diversity maintained)
3. **Phase 3**: Execute all assignments atomically
4. **Rollback**: If validation fails, clear temp table and return error

## Recommended: Approach 1 (CTE Query)

Benefits:
- Single atomic operation
- No local state tracking needed
- Easy to validate before execution
- Can be wrapped in a transaction-like structure
- Simpler logic flow

Implementation steps:
1. Build assignment plan array in JavaScript
2. Validate plan (all users have exactly 3, diversity maintained)
3. Build single SQL query with CTEs for all assignments
4. Execute query - if it fails, nothing is assigned
5. Return success/failure


