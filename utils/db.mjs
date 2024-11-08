import * as pg from "pg";
const { Pool } = pg.default;

const pool = new Pool({
  connectionString:
    "postgresql://postgres:034424274@localhost:5432/personal-blog",
});

export { pool };