const { Pool } = require("pg");

// Uses DATABASE_URL from environment, e.g.
// postgres://user:password@host:5432/sadaar
// Works as-is with Supabase, Railway, Render Postgres, or a local Postgres install.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});

module.exports = pool;
