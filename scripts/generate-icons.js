const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function createPNG(width, height, bgColor, textColor) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const combined = Buffer.concat([typeB, data]);
    const crc = crc32(combined);
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc);
    return Buffer.concat([len, combined, crcB]);
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)

  const pixels = [];
  const r = parseInt(bgColor.slice(1, 3), 16);
  const g = parseInt(bgColor.slice(3, 5), 16);
  const b = parseInt(bgColor.slice(5, 7), 16);

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const textR = parseInt(textColor.slice(1, 3), 16);
  const textG = parseInt(textColor.slice(3, 5), 16);
  const textB = parseInt(textColor.slice(5, 7), 16);

  for (let y = 0; y < height; y++) {
    pixels.push(0); // filter none
    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < Math.min(width, height) * 0.3) {
        pixels.push(textR, textG, textB);
      } else {
        pixels.push(r, g, b);
      }
    }
  }

  const raw = Buffer.from(pixels);
  const compressed = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(__dirname, "..", "icons");

const sizes = [
  { name: "icon16.png", size: 16 },
  { name: "icon48.png", size: 48 },
  { name: "icon128.png", size: 128 },
];

for (const { name, size } of sizes) {
  const png = createPNG(size, size, "#1a1a2e", "#ef4444");
  fs.writeFileSync(path.join(iconsDir, name), png);
  console.log(`Created ${name}`);
}

console.log("Icons generated.");
