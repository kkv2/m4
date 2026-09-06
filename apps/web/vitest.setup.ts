import "@testing-library/jest-dom/vitest";

// Database-backed tests need DATABASE_URL, which lives in the single .env at
// the workspace root rather than inside apps/web. Importing the server env
// contract loads that file as a side effect; its Zod validation is skipped
// under NODE_ENV=test, which Vitest sets.
import "~/env/server";
