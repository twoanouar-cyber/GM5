---
description: When working with database queries in the Electron main process,
  always use parameterized queries to prevent SQL injection
  vulnerabilities.  This means using '?' placeholders in the query and passing
  the parameters as an array to the query function.
alwaysApply: false
---

Always use parameterized queries with '?' placeholders and an array of parameters when querying the database in the Electron main process.