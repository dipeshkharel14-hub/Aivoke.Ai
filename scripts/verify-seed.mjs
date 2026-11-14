import fs from "node:fs";
const sql = fs.readFileSync("supabase/seed.sql", "utf8");
const tools = (sql.match(/^  \('[^']+', '[^']+',/gm) ?? []).length;
const categories = (sql.match(/^  \('[^']+', '[^']+', '[^']+', \d+\)/gm) ?? []).length;
if (!sql.includes("insert into public.tools") || !sql.includes("insert into public.categories")) {
  throw new Error("Seed SQL is missing expected insert statements");
}
// Use explicit insert-section boundaries to avoid counting category rows as tools.
const categorySection = sql.split("insert into public.categories")[1]?.split("insert into public.tools")[0] ?? "";
const toolSection = sql.split("insert into public.tools")[1] ?? "";
const categoryRows = (categorySection.match(/^  \('/gm) ?? []).length;
const toolRows = (toolSection.match(/^  \('/gm) ?? []).length;
console.log({ tools: toolRows, categories: categoryRows });
if (toolRows !== 123 || categoryRows !== 18) process.exit(1);
