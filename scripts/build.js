const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

const filesToCopy = [
  "background.js",
  "icons.js",
  "content.js",
  "popup.html",
  "popup.js",
  "popup.css",
  "styles.css",
  "manifest.json",
];

for (const file of filesToCopy) {
  const srcPath = path.join(rootDir, file);
  const destPath = path.join(distDir, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied: ${file}`);
  }
}

const iconsSrc = path.join(rootDir, "icons");
const iconsDest = path.join(distDir, "icons");
if (fs.existsSync(iconsSrc)) {
  fs.mkdirSync(iconsDest, { recursive: true });
  for (const file of fs.readdirSync(iconsSrc)) {
    fs.copyFileSync(path.join(iconsSrc, file), path.join(iconsDest, file));
  }
  console.log("Copied: icons/");
}

console.log("\nBuild complete → dist/");
