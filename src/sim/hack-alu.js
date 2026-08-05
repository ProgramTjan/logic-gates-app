import { parseBits, formatBits, ensureWidth, bitwiseBinary, bitwiseUnary } from "./bits.js";

function addBitsU16(x, y) {
  const w = 16;
  const a = ensureWidth(x, w);
  const b = ensureWidth(y, w);
  let carry = false;
  const out = Array(w).fill(false);
  for (let i = w - 1; i >= 0; i -= 1) {
    const xi = Boolean(a[i]);
    const yi = Boolean(b[i]);
    const sum = Boolean(xi) !== Boolean(yi) !== carry;
    carry = (xi && yi) || (carry && (xi || yi));
    out[i] = sum;
  }
  return ensureWidth(out, w);
}

/**
 * Reference for the classic 16-bit HACK / nand2tetris ALU (Figure 2.6 style).
 * Flags zx, nx, zy, ny, f, no are booleans (from "0" / "1" strings in challenges).
 */
export function computeHackAlu(xStr, yStr, flags) {
  const w = 16;
  const zx = Boolean(flags.zx === "1" || flags.zx === true);
  const nx = Boolean(flags.nx === "1" || flags.nx === true);
  const zy = Boolean(flags.zy === "1" || flags.zy === true);
  const ny = Boolean(flags.ny === "1" || flags.ny === true);
  const f = Boolean(flags.f === "1" || flags.f === true);
  const no = Boolean(flags.no === "1" || flags.no === true);

  let x = parseBits(xStr, w);
  let y = parseBits(yStr, w);
  if (zx) {
    x = zeroU16();
  }
  if (nx) {
    x = bitwiseUnary(x, (bit) => !bit);
  }
  if (zy) {
    y = zeroU16();
  }
  if (ny) {
    y = bitwiseUnary(y, (bit) => !bit);
  }

  let out = f ? addBitsU16(x, y) : bitwiseBinary(x, y, (left, right) => left && right);
  if (no) {
    out = bitwiseUnary(out, (bit) => !bit);
  }

  const zr = !out.some(Boolean);
  const ng = Boolean(out[0]);
  return {
    OUT: formatBits(out, w),
    zr: zr ? "1" : "0",
    ng: ng ? "1" : "0",
  };
}

function zeroU16() {
  return Array(16).fill(false);
}
