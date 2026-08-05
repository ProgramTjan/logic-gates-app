/**
 * Demo HACK-achtige programma's voor het eindproject Computer.
 * Instructies zijn 16-bit bitstrings (MSB links), met commentaar per regel.
 *
 * SCREEN_ROWS_DEMO schrijft opeenvolgende rijen naar een Screen die direct
 * aan CPU.outM / writeM / addressM[2:0] hangt (versimpelde memory-map).
 */

/** A-instruction encoder: @value (15-bit). */
export function aInstr(value) {
  const n = Math.max(0, Math.min(0x7fff, Number(value) || 0));
  return n.toString(2).padStart(16, "0");
}

/** C-instruction: 111 + comp(7) + dest(3) + jump(3). */
export function cInstr(comp, dest = "000", jump = "000") {
  return `111${comp}${dest}${jump}`;
}

/** Veelgebruikte C-ops (zelfde encoding als CPU-tests). */
export const C = {
  dEqA: cInstr("0110000", "010", "000"), // D=A
  mEqD: cInstr("0001100", "001", "000"), // M=D
  dEqDPlusA: cInstr("0000010", "010", "000"), // D=D+A
  aEqD: cInstr("0001100", "100", "000"), // A=D
  jmp: cInstr("0101010", "000", "111"), // 0;JMP
};

/**
 * Vult screen-rijen 0..3 met patroon 11110000 via:
 *   @pattern ; D=A ; @row ; M=D
 * daarna oneindige lus.
 */
export const SCREEN_ROWS_DEMO = Object.freeze([
  { bits: aInstr(0xf0), comment: "@240  // pixelpatroon in lage 8 bits (11110000)" },
  { bits: C.dEqA, comment: "D=A" },
  { bits: aInstr(0), comment: "@0    // row 0" },
  { bits: C.mEqD, comment: "M=D  // schrijf naar screen row 0" },
  { bits: aInstr(0xf0), comment: "@240" },
  { bits: C.dEqA, comment: "D=A" },
  { bits: aInstr(1), comment: "@1    // row 1" },
  { bits: C.mEqD, comment: "M=D" },
  { bits: aInstr(0xf0), comment: "@240" },
  { bits: C.dEqA, comment: "D=A" },
  { bits: aInstr(2), comment: "@2    // row 2" },
  { bits: C.mEqD, comment: "M=D" },
  { bits: aInstr(0xf0), comment: "@240" },
  { bits: C.dEqA, comment: "D=A" },
  { bits: aInstr(3), comment: "@3    // row 3" },
  { bits: C.mEqD, comment: "M=D" },
  { bits: aInstr(16), comment: "@16   // lus-adres" },
  { bits: C.jmp, comment: "0;JMP // blijf hangen" },
]);

/** Alleen de bitstrings (voor ROM.config.program). */
export function demoProgramBits(program = SCREEN_ROWS_DEMO) {
  return program.map((line) => line.bits);
}
