/**
 * Sample receipt photo and voice clip for the capture checks.
 * No dependencies. Speech uses macOS `say` when asked; otherwise the wav is silence,
 * which is enough for the localhost fake transcriber.
 */
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";

const execFileAsync = promisify(execFile);

export const VOICE_PHRASE = "Add a valve at forty five dollars.";
export const RECEIPT_LINES = [
  "HOME DEPOT",
  "E2E RECEIPT",
  "Valve  1  12.50",
  "Copper elbow  2  8.00",
  "SUBTOTAL  28.50",
  "HST  3.71",
  "TOTAL  32.21",
];

/** 5x7 glyphs. Rows are five bits, left to right, '#' set. */
const FONT = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
};

function glyph(ch) {
  return FONT[ch] ?? FONT[" "];
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

/** White PNG with black bitmap text. Scale keeps the letters large enough to read. */
export function receiptPng(lines = RECEIPT_LINES, scale = 4) {
  const gap = 1;
  const lineGap = 6;
  const pad = 12;
  const glyphW = 5 * scale + gap * scale;
  const glyphH = 7 * scale;
  const width = pad * 2 + Math.max(...lines.map((line) => line.length)) * glyphW;
  const height = pad * 2 + lines.length * glyphH + (lines.length - 1) * lineGap;
  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(height * rowBytes, 0xff);
  for (let y = 0; y < height; y += 1) raw[y * rowBytes] = 0;

  function plot(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * rowBytes + 1 + x * 3;
    raw[i] = 0;
    raw[i + 1] = 0;
    raw[i + 2] = 0;
  }

  lines.forEach((line, row) => {
    const top = pad + row * (glyphH + lineGap);
    [...line.toUpperCase()].forEach((ch, col) => {
      const left = pad + col * glyphW;
      const rows = glyph(ch);
      rows.forEach((bits, gy) => {
        for (let gx = 0; gx < 5; gx += 1) {
          if (bits[gx] !== "1") continue;
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) plot(left + gx * scale + sx, top + gy * scale + sy);
          }
        }
      });
    });
  });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function silentWav(seconds = 1, rate = 16000) {
  const data = Buffer.alloc(rate * seconds * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export async function writeVoice(file, { speech }) {
  if (!speech) {
    const wav = silentWav();
    await writeFile(file, wav);
    return { speech: false, bytes: wav.length };
  }
  await execFileAsync("say", ["-o", file, "--file-format=WAVE", "--data-format=LEI16@16000", VOICE_PHRASE]);
  return { speech: true };
}

export async function writeFixtures(dir, { speech = false } = {}) {
  await mkdir(dir, { recursive: true });
  const png = receiptPng();
  const receiptPath = path.join(dir, "receipt.png");
  const voicePath = path.join(dir, "voice.wav");
  await writeFile(receiptPath, png);
  const voice = await writeVoice(voicePath, { speech });
  return { receiptPath, voicePath, receiptBytes: png.length, voice };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const speech = process.argv.includes("--speech");
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "out");
  const written = await writeFixtures(dir, { speech });
  console.log(JSON.stringify(written, null, 2));
}
