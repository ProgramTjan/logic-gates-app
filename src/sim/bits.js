import { clamp } from "../lib/utils.js";

const MIN_WIDTH = 1;
const MAX_WIDTH = 16;

export function clampWidth(value) {
  return Math.round(clamp(value, MIN_WIDTH, MAX_WIDTH));
}

export function clampSplitWidth(value, totalWidth) {
  const width = Math.max(2, clampWidth(totalWidth));
  return Math.round(clamp(value, 1, width - 1));
}

export function zeroBits(width) {
  return Array(clampWidth(width)).fill(false);
}

export function normalizeBitString(value, width) {
  const normalizedWidth = clampWidth(width);
  const source = String(value ?? "")
    .replace(/[^01]/g, "")
    .slice(-normalizedWidth);
  return source.padStart(normalizedWidth, "0");
}

export function parseBits(value, width) {
  return normalizeBitString(value, width).split("").map((bit) => bit === "1");
}

export function ensureWidth(bits, width) {
  const normalizedWidth = clampWidth(width);
  if (Array.isArray(bits)) {
    const boolBits = bits.map((bit) => Boolean(bit)).slice(-normalizedWidth);
    while (boolBits.length < normalizedWidth) {
      boolBits.unshift(false);
    }
    return boolBits;
  }
  return parseBits(bits, normalizedWidth);
}

export function formatBits(bits, width) {
  return ensureWidth(bits, width || (Array.isArray(bits) ? bits.length : 1))
    .map((bit) => (bit ? "1" : "0"))
    .join("");
}

export function bitsToBoolean(bits) {
  return ensureWidth(bits, Array.isArray(bits) && bits.length ? bits.length : 1).some(Boolean);
}

export function bitwiseUnary(bits, operator) {
  const input = ensureWidth(bits, Array.isArray(bits) && bits.length ? bits.length : 1);
  return input.map((bit) => Boolean(operator(Boolean(bit))));
}

export function bitwiseBinary(leftBits, rightBits, operator) {
  const width = Math.max(
    Array.isArray(leftBits) ? leftBits.length : 1,
    Array.isArray(rightBits) ? rightBits.length : 1
  );
  const left = ensureWidth(leftBits, width);
  const right = ensureWidth(rightBits, width);
  return left.map((bit, index) => Boolean(operator(Boolean(bit), Boolean(right[index]))));
}
