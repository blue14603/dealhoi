/* Resets and seeds the end-to-end database (run with --conditions=react-server). */
import { resetTestDatabase } from "../integration/setup-db";

resetTestDatabase()
  .then((sql) => sql.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
