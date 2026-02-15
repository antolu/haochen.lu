import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, "../dist/assets");
const OUTPUT_FILE = process.argv[2];

if (!fs.existsSync(ASSETS_DIR)) {
  console.error(`Error: Assets directory not found at ${ASSETS_DIR}`);
  console.log("[]"); // Output empty array for safety
  process.exit(0);
}

const files = fs
  .readdirSync(ASSETS_DIR)
  .filter((file) => /\.(js|css|html)$/.test(file));

const report = files.map((file) => {
  const filePath = path.join(ASSETS_DIR, file);
  const content = fs.readFileSync(filePath);
  const statSize = content.length;
  const gzipSize = zlib.gzipSync(content).length;

  return {
    label: file,
    statSize: statSize,
    parsedSize: statSize, // Approximation
    gzipSize: gzipSize,
  };
});

const jsonOutput = JSON.stringify(report, null, 2);

if (OUTPUT_FILE) {
  fs.writeFileSync(OUTPUT_FILE, jsonOutput);
  console.log(`Bundle report generated at ${OUTPUT_FILE}`);
} else {
  console.log(jsonOutput);
}
