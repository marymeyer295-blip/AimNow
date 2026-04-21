import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://admin:Z3a!Play%402026%23Secure@161.97.147.179:5432/preaimnowtable',
  ssl: false
});

async function run() {
  const r = await pool.query("SELECT * FROM leads LIMIT 1");
  console.log("Columns:", Object.keys(r.rows[0]));
  const constraint = await pool.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'discovery_answers_answer_source_check'");
  if (constraint.rows.length) {
    console.log("Constraint:", constraint.rows[0]);
  }
  pool.end();
}
run();
