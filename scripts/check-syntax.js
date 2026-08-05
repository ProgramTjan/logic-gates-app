import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function collectJsFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "node_modules" && name !== ".git") {
        collectJsFiles(path, files);
      }
    } else if (name.endsWith(".js")) {
      files.push(path);
    }
  }
  return files;
}

const files = [
  join(root, "script.js"),
  join(root, "sw.js"),
  join(root, "src", "main.js"),
  ...collectJsFiles(join(root, "src")),
  ...collectJsFiles(join(root, "scripts")),
];

let failed = 0;
for (const file of files) {
  const result = spawnSync("node", ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(`FAIL ${file}`);
    if (result.stderr) console.error(result.stderr.trim());
    failed++;
  } else {
    console.log(`OK   ${file}`);
  }
}

if (failed) {
  console.error(`\n${failed} file(s) failed syntax check.`);
  process.exit(1);
}
console.log(`\nAll ${files.length} files passed.`);
