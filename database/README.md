Postgres migrations — editor configuration
========================================

This repository's SQL migrations are written for PostgreSQL. Some editors/SQL extensions (or server-based linters) default to other dialects (for example, Microsoft T-SQL) and will show many "Incorrect syntax near ..." diagnostics.

If you see lots of SQL errors in VS Code for files under `database/migrations` (like `Incorrect syntax near`), do one of the following:

- Use sqlfluff with the Postgres dialect. A repository-level `.sqlfluff` file is present with `dialect = postgres`.
- In VS Code workspace settings (`.vscode/settings.json`) we've added a workspace config that sets `sqlfluff.dialect` to `postgres` and associates `.sql` files with SQL.
- If your SQL extension is showing T-SQL diagnostics (SQL Server), change the language mode for these files to PostgreSQL or disable that extension for the workspace.

Quick checks:

- Ensure you have the SqlFluff extension or CLI configured for Postgres:
  - CLI: `pip install sqlfluff` then `sqlfluff lint --dialect postgres database/migrations/*.sql`
- If you're using an editor extension that targets SQL Server (mssql), switch its dialect for this workspace or disable it.

If you'd like, I can also:
- Validate each migration by running `psql -f` against a local Postgres instance and report true syntax errors.
- Convert problematic migrations to standard Postgres SQL where necessary.
