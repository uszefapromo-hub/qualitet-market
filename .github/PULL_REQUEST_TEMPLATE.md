## Summary

<!-- Briefly describe the problem or feature this PR addresses. -->

## Type of change

- [ ] Bug fix
- [ ] New feature / new module
- [ ] Refactor / improvement
- [ ] Documentation update
- [ ] Migration / database schema change

## Database (`NNN_migration_name.sql`)

<!-- Describe new tables, columns, or indexes added. Delete this section if no migration. -->

## Backend

<!-- List new or changed API routes, route files, and helpers.
     Include endpoint table if adding multiple routes:

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/...` | ... |
-->

## Frontend

<!-- Describe changes to HTML pages, CSS, or Vanilla JS files. -->

## API client (`js/api.js`)

<!-- Describe new `QMApi.*` namespaces or methods added. Delete if not applicable. -->

## Tests

<!-- State the test count change, e.g. "N new tests; X total passing." -->

## Checklist

- [ ] Parameterised SQL queries only — no string concatenation
- [ ] New endpoints protected by `requireAuth` / `requireAdmin` where appropriate
- [ ] `auditLog()` called fire-and-forget (no `await`) for state-changing operations
- [ ] `escHtml()` used for all dynamic DOM output in frontend
- [ ] Migration file numbered sequentially and added to `backend/migrations/migrate.js`
- [ ] All existing tests still pass (`cd backend && npm test`)
