const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const distDir = path.join(__dirname, "..", "dist");
const rootDir = path.join(__dirname, "..");

if (!fs.existsSync(distDir)) {
  console.log("Run 'npm run build' first.");
  process.exit(1);
}

const version = JSON.parse(
  fs.readFileSync(path.join(rootDir, "manifest.json"), "utf-8")
).version;

const outputName = `bullshit-detector-v${version}.zip`;

try {
  execSync(
    `powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${path.join(
      rootDir,
      outputName
    )}' -Force"`,
    { stdio: "inherit" }
  );
  console.log(`\nPackage created: ${outputName}`);
} catch (err) {
  console.error("Packaging failed:", err.message);
}
