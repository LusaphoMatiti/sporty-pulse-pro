import fs from "fs";
import path from "path";
import { glob } from "glob";

const API_DIR = path.join(process.cwd(), "src/app/api");

async function main() {
  const files = await glob("**/route.ts", { cwd: API_DIR, absolute: true });

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    let src = fs.readFileSync(file, "utf8");
    const original = src;

    // Replace bare internalError() → internalError(err)
    // Safe because every catch block in the codebase uses (err) as the variable
    src = src.replace(/internalError\(\)/g, "internalError(err)");

    // If file uses internalError but has no api-response import at all, skip —
    // it will need manual attention (logged below)
    if (
      src.includes("internalError(err)") &&
      !src.includes("@/lib/api-response")
    ) {
      console.log(
        `⚠️  no api-response import found — check manually: ${path.relative(process.cwd(), file)}`,
      );
    }

    if (src !== original) {
      fs.writeFileSync(file, src, "utf8");
      console.log(`✅ updated: ${path.relative(process.cwd(), file)}`);
      updated++;
    } else {
      console.log(`⏭  skipped: ${path.relative(process.cwd(), file)}`);
      skipped++;
    }
  }

  console.log(`\nDone. ${updated} updated, ${skipped} already correct.`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
