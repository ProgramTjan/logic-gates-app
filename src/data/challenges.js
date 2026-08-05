import { computeHackAlu } from "../sim/hack-alu.js";
import { applyPrerequisitesToChallenges } from "./curriculum.js";
import { demoProgramBits, SCREEN_ROWS_DEMO } from "./demo-programs.js";

const Z16 = "0".repeat(16);

function aluTestRow(x, y, zx, nx, zy, ny, f, no) {
  const o = computeHackAlu(x, y, { zx, nx, zy, ny, f, no });
  return {
    inputs: { X: x, Y: y, ZX: zx, NX: nx, ZY: zy, NY: ny, F: f, NO: no },
    outputs: { OUT: o.OUT, ZR: o.zr, NG: o.ng },
  };
}

/** Representative HACK-ALU cases (reference implementation in src/sim/hack-alu.js). */
const ALU_TESTS = [
  aluTestRow(Z16, Z16, "1", "0", "1", "0", "1", "0"),
  aluTestRow(Z16, Z16, "1", "1", "1", "1", "1", "1"),
  aluTestRow(Z16, Z16, "1", "1", "1", "0", "1", "0"),
  aluTestRow("0000000000000100", "0000000000000011", "0", "0", "0", "0", "0", "0"),
  aluTestRow("0000000000000100", "0000000000000011", "0", "0", "0", "0", "1", "0"),
  aluTestRow("0000000000000100", "0000000000000011", "0", "0", "0", "0", "1", "1"),
  aluTestRow("0000000000000100", "0000000000000011", "0", "0", "0", "0", "0", "1"),
  aluTestRow("1111111111111011", "0000000000000001", "0", "0", "0", "0", "1", "0"),
  aluTestRow("0000000000000001", Z16, "0", "0", "1", "1", "1", "1"),
  aluTestRow("1000000000000000", "1000000000000000", "0", "0", "0", "0", "1", "0"),
  aluTestRow("1000000000000000", "1000000000000000", "0", "0", "0", "0", "0", "0"),
];

/** Pad binary address for RAM test scripts. */
function padAddr(value, width) {
  return String(value).padStart(width, "0").slice(-width);
}

/** Split a 16-bit HACK instruction into decoder fields (MSB-left bitstring). */
function decodeHackInstruction(bits) {
  const b = String(bits).padStart(16, "0").slice(-16);
  return {
    isA: b[0] === "0" ? "1" : "0",
    comp: b.slice(3, 10),
    dest: b.slice(10, 13),
    jump: b.slice(13, 16),
  };
}

/** Encode common HACK instructions used in decoder / CPU tests. */
const HACK_INSTR = {
  at21: "0000000000010101", // @21
  at7: "0000000000000111", // @7
  at3: "0000000000000011", // @3
  at100: "0000000001100100", // @100
  dEqA: "1110110000010000", // D=A
  dEqDPlusA: "1110000010010000", // D=D+A
  dEqDPlusM: "1111000010010000", // D=D+M
  aEqD: "1110001100100000", // A=D
  jmp: "1110101010000111", // 0;JMP
};

/** Shared sequential script: write/read two RAM cells. */
function makeRamScript(addrWidth) {
  const z = Z16;
  const w = "0000000000000101";
  const a0 = padAddr(0, addrWidth);
  const a1 = padAddr(1, addrWidth);
  return [
    { tick: true, inputs: { IN: z, LOAD: "0", ADDR: a0, CLK: "0" } },
    { expect: { OUT: z }, inputs: { IN: z, LOAD: "0", ADDR: a0, CLK: "0" } },
    { tick: true, inputs: { IN: w, LOAD: "1", ADDR: a0, CLK: "1" } },
    { tick: true, inputs: { IN: z, LOAD: "0", ADDR: a0, CLK: "0" } },
    { expect: { OUT: w }, inputs: { IN: z, LOAD: "0", ADDR: a0, CLK: "0" } },
    { expect: { OUT: z }, inputs: { LOAD: "0", ADDR: a1, CLK: "0" } },
    { tick: true, inputs: { IN: w, LOAD: "1", ADDR: a1, CLK: "1" } },
    { tick: true, inputs: { IN: z, LOAD: "0", ADDR: a1, CLK: "0" } },
    { expect: { OUT: w }, inputs: { LOAD: "0", ADDR: a1, CLK: "0" } },
    { expect: { OUT: z }, inputs: { LOAD: "0", ADDR: a0, CLK: "0" } },
  ];
}

function makeRamChallenge(id, title, names, addrWidth, phase = "Project 5") {
  return {
    id,
    phase,
    title,
    names,
    inputs: 4,
    outputs: 1,
    description: `${title}: ${2 ** addrWidth} woorden × 16 bit. LOAD=1 + CLK-tick schrijft IN naar geheugen[ADDR]; OUT leest combinationeel.`,
    verification: "sequential-script",
    template: {
      inputs: [
        { name: "IN", width: 16 },
        "LOAD",
        { name: "ADDR", width: addrWidth },
        "CLK",
      ],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: [
      "Stapel RAM8/RAM64-chips of registers met adresdecodering (Mux/DMux).",
      "OUT moet de geselecteerde cel combinationeel tonen.",
      `ADDR is ${addrWidth}-bit (${2 ** addrWidth} woorden).`,
    ],
    script: makeRamScript(addrWidth),
    theory: [
      `${title} is een grotere geheugenbank — dezelfde LOAD/ADDR/CLK-interface als RAM8, maar meer adresbits.`,
      "Bouw hiërarchisch: elke verdubbeling van het geheugen is vaak 'acht keer de kleinere RAM + extra adresbit'.",
    ],
  };
}

export const CHALLENGES = [
  {
    id: "nand",
    phase: "Project 1",
    title: "Build NAND",
    names: ["NAND"],
    inputs: 2,
    outputs: 1,
    description: "Maak je eigen NAND-chip zonder de starterversie te gebruiken.",
    verification: "combinational",
    template: { inputs: ["A", "B"], outputs: ["OUT"] },
    hints: [
      "Gebruik twee Input nodes met namen A en B.",
      "Maak precies één Output node met naam OUT.",
      "Bouw met bestaande poorten en sla daarna je chip op als NAND.",
    ],
    tests: [
      { inputs: { A: "0", B: "0" }, outputs: { OUT: "1" } },
      { inputs: { A: "0", B: "1" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "0" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "1" }, outputs: { OUT: "0" } },
    ],
    theory: [
      "Een bit is de kleinste eenheid informatie: 0 (laag, false, uit) of 1 (hoog, true, aan). Alles in een computer is opgebouwd uit miljoenen van dit soort schakelaars.",
      "Een logische poort combineert één of meer bits tot een nieuw bit. De NAND-poort (Not-AND) geeft pas 0 als BEIDE inputs 1 zijn — anders altijd 1.",
      "NAND is de universele bouwsteen: elke andere logische functie kan uitsluitend met NAND-gates worden gebouwd. Dit project begint hier bewust — zodra je NAND hebt, heb je alles.",
      "Bouw-strategie: gebruik de ingebouwde NAND-gate uit de Parts-balk. Verbind A en B direct aan de gate, en de output aan je OUT-pin.",
    ],
  },
  {
    id: "not",
    phase: "Project 1",
    title: "Build NOT",
    names: ["NOT"],
    inputs: 1,
    outputs: 1,
    description: "Bouw een inverterchip met 1 input en 1 output.",
    verification: "combinational",
    template: { inputs: ["IN"], outputs: ["OUT"] },
    hints: ["Gebruik één Input en één Output.", "Laat OUT altijd het inverse zijn van IN."],
    tests: [
      { inputs: { IN: "0" }, outputs: { OUT: "1" } },
      { inputs: { IN: "1" }, outputs: { OUT: "0" } },
    ],
    theory: [
      "De NOT-poort (inverter) keert een bit om: 0 wordt 1 en 1 wordt 0. Het is de eenvoudigste poort.",
      "Je kunt NOT bouwen vanuit NAND: verbind beide NAND-ingangen met dezelfde input IN. Omdat A=B geldt dan: NAND(1,1)=0 en NAND(0,0)=1 — precies het gedrag van NOT.",
      "NOT vormt de basis voor alle 'negatieve' logica: NAND, NOR, XNOR zijn allemaal combinaties met NOT.",
    ],
  },
  {
    id: "and",
    phase: "Project 1",
    title: "Build AND",
    names: ["AND"],
    inputs: 2,
    outputs: 1,
    description: "Bouw AND uit je bestaande bouwblokken.",
    verification: "combinational",
    template: { inputs: ["A", "B"], outputs: ["OUT"] },
    hints: [
      "Gebruik A en B als inputs en OUT als output.",
      "Alleen wanneer A en B beide 1 zijn mag OUT ook 1 zijn.",
    ],
    tests: [
      { inputs: { A: "0", B: "0" }, outputs: { OUT: "0" } },
      { inputs: { A: "0", B: "1" }, outputs: { OUT: "0" } },
      { inputs: { A: "1", B: "0" }, outputs: { OUT: "0" } },
      { inputs: { A: "1", B: "1" }, outputs: { OUT: "1" } },
    ],
    theory: [
      "AND geeft 1 alleen als BEIDE inputs 1 zijn. In een elektrisch circuit: twee schakelaars in serie — alleen als allebei gesloten zijn, stroomt er stroom.",
      "AND is letterlijk NOT(NAND): de NAND-gate gevolgd door een NOT-gate geeft AND. Gebruik je zelfgebouwde chips!",
      "AND is fundamenteel voor maskeren (filteren van bits) en conditionele logica in processoren.",
    ],
  },
  {
    id: "or",
    phase: "Project 1",
    title: "Build OR",
    names: ["OR"],
    inputs: 2,
    outputs: 1,
    description: "Maak een OR-chip in dezelfde stijl als NAND2Tetris.",
    verification: "combinational",
    template: { inputs: ["A", "B"], outputs: ["OUT"] },
    hints: ["Gebruik twee data-inputs A en B.", "OUT is 1 zodra minstens één input 1 is."],
    tests: [
      { inputs: { A: "0", B: "0" }, outputs: { OUT: "0" } },
      { inputs: { A: "0", B: "1" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "0" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "1" }, outputs: { OUT: "1" } },
    ],
    theory: [
      "OR geeft 1 als MINSTENS één input 1 is. Twee schakelaars parallel: als één gesloten is, stroomt er stroom.",
      "De De Morgan-regel: OR(A,B) = NOT(NAND(NOT(A), NOT(B))). Dat klinkt ingewikkeld maar is het niet: negeer beide inputs, gooi ze door NAND, negeer het resultaat.",
      "Praktische toepassing: OR gebruik je voor 'is er iets actief?' — denk aan foutdetectie, interrupts, enable-signalen.",
    ],
  },
  {
    id: "xor",
    phase: "Project 1",
    title: "Build XOR",
    names: ["XOR"],
    inputs: 2,
    outputs: 1,
    description: "Bouw XOR als composietchip.",
    verification: "combinational",
    template: { inputs: ["A", "B"], outputs: ["OUT"] },
    hints: [
      "Gebruik XOR-logica: precies één input hoog geeft een hoge output.",
      "Controleer alle vier combinaties voordat je opslaat.",
    ],
    tests: [
      { inputs: { A: "0", B: "0" }, outputs: { OUT: "0" } },
      { inputs: { A: "0", B: "1" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "0" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "1" }, outputs: { OUT: "0" } },
    ],
    theory: [
      "XOR (Exclusive OR) geeft 1 als de inputs VERSCHILLEN: één is 0 en de ander is 1. Als ze gelijk zijn, geeft XOR altijd 0.",
      "XOR is de kern van binaire optelling: 0+0=0, 0+1=1, 1+0=1, 1+1=0 (met carry) — de SUM-kolom is precies XOR.",
      "Klassieke implementatie met vier NAND-gates: NAND(A,B) geeft hulpresultaat H. Dan AND(OR(A,B), H) — of directer: NAND(NAND(A,H), NAND(B,H)).",
    ],
  },
  {
    id: "xor-nand-only",
    phase: "Project 1",
    title: "Build XOR (alleen NAND)",
    names: ["XORNAND"],
    inputs: 2,
    outputs: 1,
    description:
      "Zelfde waarheidstabel als XOR, maar je mag alleen ingebouwde NAND-poorten gebruiken (geen AND/OR/NOT/XOR op de canvas). Sub-chips mogen wél, zolang die ook alleen NAND bevatten.",
    verification: "combinational",
    gateConstraint: { allowedGateTypes: ["NAND"] },
    template: { inputs: ["A", "B"], outputs: ["OUT"] },
    hints: [
      "Je Output-pin moet OUT heten (zoals bij andere opdrachten).",
      "Sla de chip op onder de naam XORNAND.",
      "Alleen node-type NAND is toegestaan naast Input/Output, wires, Splitter/Joiner en eigen chips.",
    ],
    tests: [
      { inputs: { A: "0", B: "0" }, outputs: { OUT: "0" } },
      { inputs: { A: "0", B: "1" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "0" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "1" }, outputs: { OUT: "0" } },
    ],
    theory: [
      "Deze opdracht dwingt het universele-karakter van NAND af: elke booleaanse functie is op te bouwen met alleen NAND’s.",
      "Splitter en Joiner zijn geen logische poorten — die mag je gebruiken voor brede bussen als je XOR op meerdere bits bouwt.",
      "Als je een tussen-chip maakt, controleer die ook op verborgen AND/OR/NOT: de checker kijkt recursief in opgeslagen chips.",
    ],
  },
  {
    id: "mux",
    phase: "Project 1",
    title: "Build MUX",
    names: ["MUX", "Mux"],
    inputs: 3,
    outputs: 1,
    description: "Maak een multiplexer met twee datalijnen en één select.",
    verification: "combinational",
    template: { inputs: ["A", "B", "SEL"], outputs: ["OUT"] },
    hints: ["Gebruik A, B en SEL als inputs.", "Als SEL=0 moet OUT=A zijn; als SEL=1 moet OUT=B zijn."],
    tests: [
      { inputs: { A: "0", B: "1", SEL: "0" }, outputs: { OUT: "0" } },
      { inputs: { A: "0", B: "1", SEL: "1" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "0", SEL: "0" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "0", SEL: "1" }, outputs: { OUT: "0" } },
    ],
    theory: [
      "Een MUX (multiplexer) is een programmeerbare dataswitch: SEL=0 laat A door, SEL=1 laat B door. Alsof je een wisselschakelaar op een spoorrail zet.",
      "Formule: OUT = (A AND NOT(SEL)) OR (B AND SEL). Dit kun je direct met AND, NOT en OR implementeren.",
      "MUX is extreem krachtig: met genoeg select-lijnen kun je elke logische functie implementeren puur met MUX-gates. Processors gebruiken MUX'en continu voor datarouting.",
    ],
  },
  {
    id: "dmux",
    phase: "Project 1",
    title: "Build DMUX",
    names: ["DMUX", "DMux"],
    inputs: 2,
    outputs: 2,
    description: "Splits één input naar twee outputs op basis van een select-lijn.",
    verification: "combinational",
    template: { inputs: ["IN", "SEL"], outputs: ["A", "B"] },
    hints: [
      "Gebruik IN en SEL als inputs.",
      "Als SEL=0 gaat IN naar A en blijft B laag.",
      "Als SEL=1 gaat IN naar B en blijft A laag.",
    ],
    tests: [
      { inputs: { IN: "0", SEL: "0" }, outputs: { A: "0", B: "0" } },
      { inputs: { IN: "1", SEL: "0" }, outputs: { A: "1", B: "0" } },
      { inputs: { IN: "0", SEL: "1" }, outputs: { A: "0", B: "0" } },
      { inputs: { IN: "1", SEL: "1" }, outputs: { A: "0", B: "1" } },
    ],
    theory: [
      "DMUX (demultiplexer) is het omgekeerde van MUX: één input wordt naar één van twee outputs gestuurd. De andere output blijft altijd 0.",
      "Formule: A = IN AND NOT(SEL), B = IN AND SEL. Twee AND-gates zijn voldoende.",
      "DMUX is de basis voor adressering: selecteer met SEL-bits welk onderdeel van het systeem een signaal ontvangt — geheugenbank, register, I/O-poort.",
    ],
  },
  {
    id: "not16",
    phase: "Project 1",
    title: "Build Not16",
    names: ["Not16", "NOT16"],
    inputs: 1,
    outputs: 1,
    description: "16-bit inverter: elke bit van IN wordt omgekeerd naar OUT.",
    verification: "combinational",
    template: {
      inputs: [{ name: "IN", width: 16 }],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: [
      "Gebruik een NOT-gate met width=16, of zestien 1-bit NOT’s met Splitter/Joiner.",
      "MSB staat links in de bitstring.",
    ],
    tests: [
      { inputs: { IN: "0000000000000000" }, outputs: { OUT: "1111111111111111" } },
      { inputs: { IN: "1111111111111111" }, outputs: { OUT: "0000000000000000" } },
      { inputs: { IN: "1010101010101010" }, outputs: { OUT: "0101010101010101" } },
      { inputs: { IN: "0000000000000001" }, outputs: { OUT: "1111111111111110" } },
      { inputs: { IN: "1000000000000000" }, outputs: { OUT: "0111111111111111" } },
      { inputs: { IN: "1111000011110000" }, outputs: { OUT: "0000111100001111" } },
    ],
    theory: [
      "Not16 is bitwise NOT: elke bit onafhankelijk omkeren. Geen carry tussen posities — parallel werk.",
      "In de ALU gebruik je Not16 om operanden te negeren (nx/ny/no-stuurbits in HACK).",
    ],
  },
  {
    id: "and16",
    phase: "Project 1",
    title: "Build And16",
    names: ["And16", "AND16"],
    inputs: 2,
    outputs: 1,
    description: "16-bit AND: OUT[i] = A[i] AND B[i] voor elke bitpositie.",
    verification: "combinational",
    template: {
      inputs: [
        { name: "A", width: 16 },
        { name: "B", width: 16 },
      ],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: [
      "Een AND-gate met width=16 volstaat, of herhaal 1-bit AND per positie.",
      "Handig later voor maskeren in de ALU.",
    ],
    tests: [
      { inputs: { A: "0000000000000000", B: "1111111111111111" }, outputs: { OUT: "0000000000000000" } },
      { inputs: { A: "1111111111111111", B: "1111111111111111" }, outputs: { OUT: "1111111111111111" } },
      { inputs: { A: "1010101010101010", B: "1100110011001100" }, outputs: { OUT: "1000100010001000" } },
      { inputs: { A: "0000000011111111", B: "0000111100001111" }, outputs: { OUT: "0000000000001111" } },
      { inputs: { A: "1111000011110000", B: "1010101010101010" }, outputs: { OUT: "1010000010100000" } },
      { inputs: { A: "0000000000000001", B: "0000000000000001" }, outputs: { OUT: "0000000000000001" } },
    ],
    theory: [
      "And16 is bitwise AND over een hele bus — ideaal om bits te maskeren of te clearen.",
      "In de HACK-ALU levert And16 de f=0-tak (AND i.p.v. ADD).",
    ],
  },
  {
    id: "or16",
    phase: "Project 1",
    title: "Build Or16",
    names: ["Or16", "OR16"],
    inputs: 2,
    outputs: 1,
    description: "16-bit OR: OUT[i] = A[i] OR B[i] voor elke bitpositie.",
    verification: "combinational",
    template: {
      inputs: [
        { name: "A", width: 16 },
        { name: "B", width: 16 },
      ],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: ["Zelfde patroon als And16, maar met OR.", "Width=16 op de builtin OR-gate werkt direct."],
    tests: [
      { inputs: { A: "0000000000000000", B: "0000000000000000" }, outputs: { OUT: "0000000000000000" } },
      { inputs: { A: "0000000000000000", B: "1111111111111111" }, outputs: { OUT: "1111111111111111" } },
      { inputs: { A: "1010101010101010", B: "0101010101010101" }, outputs: { OUT: "1111111111111111" } },
      { inputs: { A: "0000111100001111", B: "0011001100110011" }, outputs: { OUT: "0011111100111111" } },
      { inputs: { A: "1000000000000000", B: "0000000000000001" }, outputs: { OUT: "1000000000000001" } },
      { inputs: { A: "1111000011110000", B: "0000111100001111" }, outputs: { OUT: "1111111111111111" } },
    ],
    theory: [
      "Or16 is bitwise OR: bits worden per positie gecombineerd zonder interactie tussen posities.",
      "Handig om vlaggen of enable-maskers te zetten over een hele bus.",
    ],
  },
  {
    id: "mux16",
    phase: "Project 1",
    title: "Build Mux16",
    names: ["Mux16", "MUX16"],
    inputs: 3,
    outputs: 1,
    description: "16-bit multiplexer: SEL=0 → OUT=A, SEL=1 → OUT=B (hele bus).",
    verification: "combinational",
    template: {
      inputs: [
        { name: "A", width: 16 },
        { name: "B", width: 16 },
        "SEL",
      ],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: [
      "Hergebruik je 1-bit MUX zestien keer, of bouw met And16/Or16/Not16: OUT = (A AND Not16(SEL…)) OR (B AND SEL…).",
      "SEL is 1 bit; die moet je naar 16 bits ‘verbreden’ (alle bits gelijk aan SEL) als je bus-AND gebruikt.",
    ],
    tests: [
      {
        inputs: { A: "0000000000000000", B: "1111111111111111", SEL: "0" },
        outputs: { OUT: "0000000000000000" },
      },
      {
        inputs: { A: "0000000000000000", B: "1111111111111111", SEL: "1" },
        outputs: { OUT: "1111111111111111" },
      },
      {
        inputs: { A: "1010101010101010", B: "0101010101010101", SEL: "0" },
        outputs: { OUT: "1010101010101010" },
      },
      {
        inputs: { A: "1010101010101010", B: "0101010101010101", SEL: "1" },
        outputs: { OUT: "0101010101010101" },
      },
      {
        inputs: { A: "0000111100001111", B: "1111000011110000", SEL: "0" },
        outputs: { OUT: "0000111100001111" },
      },
      {
        inputs: { A: "0000111100001111", B: "1111000011110000", SEL: "1" },
        outputs: { OUT: "1111000011110000" },
      },
    ],
    theory: [
      "Mux16 kiest tussen twee 16-bit bussen met één select-bit — de ruggengraat van datapaths.",
      "In RAM en ALU zie je Mux16 overal: kies registerwaarde, kies geheugenwoord, kies ALU-tak.",
    ],
  },
  {
    id: "or4way",
    phase: "Project 1",
    title: "Build Or4Way",
    names: ["Or4Way", "Or4"],
    inputs: 1,
    outputs: 1,
    description: "Geef 1 als minstens één bit van de 4-bit invoer hoog is.",
    verification: "combinational",
    template: { inputs: [{ name: "IN", width: 4 }], outputs: ["OUT"] },
    hints: [
      "Gebruik een Splitter (width=4, highWidth=1) om bit voor bit uit IN te halen.",
      "OR alle vier bits samen met drie OR-gates in een ketting.",
      "Tip: sla de losse OR en AND chips eerst op vanuit de Challenges als je die nog nodig hebt.",
    ],
    tests: [
      { inputs: { IN: "0000" }, outputs: { OUT: "0" } },
      { inputs: { IN: "1000" }, outputs: { OUT: "1" } },
      { inputs: { IN: "0001" }, outputs: { OUT: "1" } },
      { inputs: { IN: "0101" }, outputs: { OUT: "1" } },
      { inputs: { IN: "1010" }, outputs: { OUT: "1" } },
      { inputs: { IN: "1111" }, outputs: { OUT: "1" } },
    ],
    theory: [
      "Or4Way breidt OR uit naar meerdere bits: de output is 1 zodra ÉÉN van de vier input-bits hoog is. Dit heet een 'reduction OR'.",
      "Multi-bit bussen: in dit project gebruik je een 4-bit wide Input-pin. De Splitter-node knipt die bus op in losse bits (stel highWidth=1 in). Zo krijg je bit 3 in HI en bits 2-0 in LO — herhaal dit patroon.",
      "Or4Way is nuttig als nuldetecter: als Or4Way(x) = 0, dan is x == 0. Later gebruik je dit in de ALU om de 'zero'-vlag te berekenen.",
    ],
  },
  {
    id: "mux4way",
    phase: "Project 1",
    title: "Build Mux4Way",
    names: ["Mux4Way", "Mux4"],
    inputs: 6,
    outputs: 1,
    description: "Kies één van vier data-inputs op basis van select-lijnen S0 en S1.",
    verification: "combinational",
    template: { inputs: ["A", "B", "C", "D", "S0", "S1"], outputs: ["OUT"] },
    hints: [
      "S0=0,S1=0 → A · S0=1,S1=0 → B · S0=0,S1=1 → C · S0=1,S1=1 → D.",
      "Gebruik twee MUX-chips: één voor {A,B} en één voor {C,D}, met S0 als select.",
      "Combineer hun outputs met een derde MUX op S1.",
    ],
    tests: [
      { inputs: { A: "0", B: "1", C: "0", D: "1", S0: "0", S1: "0" }, outputs: { OUT: "0" } },
      { inputs: { A: "0", B: "1", C: "0", D: "1", S0: "1", S1: "0" }, outputs: { OUT: "1" } },
      { inputs: { A: "0", B: "1", C: "1", D: "0", S0: "0", S1: "1" }, outputs: { OUT: "1" } },
      { inputs: { A: "0", B: "1", C: "1", D: "0", S0: "1", S1: "1" }, outputs: { OUT: "0" } },
      { inputs: { A: "1", B: "0", C: "0", D: "1", S0: "0", S1: "0" }, outputs: { OUT: "1" } },
      { inputs: { A: "1", B: "0", C: "0", D: "1", S0: "1", S1: "1" }, outputs: { OUT: "1" } },
    ],
    theory: [
      "Mux4Way heeft twee select-bits (S0, S1) en kan daarmee 4 mogelijke keuzes (2² = 4) adresseren. Met n select-bits adresseer je 2ⁿ inputs.",
      "Bouwprincipe: verdeel-en-heers. Twee gewone MUX'en verwerken {A,B} en {C,D} elk op S0. Een derde MUX kiest daarna op S1 het juiste paar.",
      "Mux4Way vormt de basis van Mux8Way en uiteindelijk geheugen: een RAM-chip is in essentie een enorme boom van MUX-gates die een adres omzetten in een specifieke cel.",
    ],
  },
  {
    id: "dmux4way",
    phase: "Project 1",
    title: "Build DMux4Way",
    names: ["DMux4Way", "DMux4"],
    inputs: 3,
    outputs: 4,
    description: "Stuur één input door naar één van vier outputs op basis van S0 en S1.",
    verification: "combinational",
    template: { inputs: ["IN", "S0", "S1"], outputs: ["A", "B", "C", "D"] },
    hints: [
      "S0=0,S1=0 → A · S0=1,S1=0 → B · S0=0,S1=1 → C · S0=1,S1=1 → D.",
      "Gebruik eerst een DMUX met S1 om IN op te splitsen in twee takken.",
      "Pas per tak een DMUX met S0 toe om verder op te splitsen.",
    ],
    tests: [
      { inputs: { IN: "1", S0: "0", S1: "0" }, outputs: { A: "1", B: "0", C: "0", D: "0" } },
      { inputs: { IN: "1", S0: "1", S1: "0" }, outputs: { A: "0", B: "1", C: "0", D: "0" } },
      { inputs: { IN: "1", S0: "0", S1: "1" }, outputs: { A: "0", B: "0", C: "1", D: "0" } },
      { inputs: { IN: "1", S0: "1", S1: "1" }, outputs: { A: "0", B: "0", C: "0", D: "1" } },
      { inputs: { IN: "0", S0: "1", S1: "1" }, outputs: { A: "0", B: "0", C: "0", D: "0" } },
    ],
    theory: [
      "DMux4Way is het omgekeerde van Mux4Way: één signaal wordt naar precies één van vier bestemmingen gestuurd, afhankelijk van S0 en S1.",
      "Bouwprincipe: een eerste DMUX op S1 splitst IN in twee 'takken'. Elke tak gaat naar een tweede DMUX op S0. Resultaat: een boomstructuur met 4 bladeren.",
      "DMux4Way is de basis voor geheugenadressering: geef aan welke RAM-bank een schrijfopdracht ontvangt. Combineer DMux4Way met Mux4Way voor lees+schrijf geheugen.",
    ],
  },
  {
    id: "or8way",
    phase: "Project 1",
    title: "Build Or8Way",
    names: ["Or8Way", "Or8"],
    inputs: 1,
    outputs: 1,
    description: "Reduction-OR over 8 bits: OUT=1 als minstens één bit van IN hoog is.",
    verification: "combinational",
    template: {
      inputs: [{ name: "IN", width: 8 }],
      outputs: ["OUT"],
    },
    hints: [
      "Splitter (width=8) + OR-ketting, of twee Or4Way-chips + OR.",
      "OUT=0 alleen bij IN=00000000 — handig als zero-detectie-bouwsteen.",
    ],
    tests: [
      { inputs: { IN: "00000000" }, outputs: { OUT: "0" } },
      { inputs: { IN: "10000000" }, outputs: { OUT: "1" } },
      { inputs: { IN: "00000001" }, outputs: { OUT: "1" } },
      { inputs: { IN: "00010000" }, outputs: { OUT: "1" } },
      { inputs: { IN: "10101010" }, outputs: { OUT: "1" } },
      { inputs: { IN: "11111111" }, outputs: { OUT: "1" } },
    ],
    theory: [
      "Or8Way is de 8-bit variant van Or4Way: één bit dat zegt of er ergens een 1 in de bus zit.",
      "In de ALU bouw je zr vaak als NOT(Or8Way(high) OR Or8Way(low)) op de 16-bit OUT.",
    ],
  },
  {
    id: "mux4way16",
    phase: "Project 1",
    title: "Build Mux4Way16",
    names: ["Mux4Way16", "Mux4Way16b"],
    inputs: 5,
    outputs: 1,
    description: "Kies één van vier 16-bit bussen met een 2-bit SEL (00=A … 11=D).",
    verification: "combinational",
    template: {
      inputs: [
        { name: "A", width: 16 },
        { name: "B", width: 16 },
        { name: "C", width: 16 },
        { name: "D", width: 16 },
        { name: "SEL", width: 2 },
      ],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: [
      "SEL=00→A, 01→B, 10→C, 11→D (MSB van SEL staat links).",
      "Twee Mux16'en op SEL[0], daarna één Mux16 op SEL[1] — zelfde boom als Mux4Way.",
    ],
    tests: [
      {
        inputs: {
          A: "0000000000000001",
          B: "0000000000000010",
          C: "0000000000000100",
          D: "0000000000001000",
          SEL: "00",
        },
        outputs: { OUT: "0000000000000001" },
      },
      {
        inputs: {
          A: "0000000000000001",
          B: "0000000000000010",
          C: "0000000000000100",
          D: "0000000000001000",
          SEL: "01",
        },
        outputs: { OUT: "0000000000000010" },
      },
      {
        inputs: {
          A: "0000000000000001",
          B: "0000000000000010",
          C: "0000000000000100",
          D: "0000000000001000",
          SEL: "10",
        },
        outputs: { OUT: "0000000000000100" },
      },
      {
        inputs: {
          A: "0000000000000001",
          B: "0000000000000010",
          C: "0000000000000100",
          D: "0000000000001000",
          SEL: "11",
        },
        outputs: { OUT: "0000000000001000" },
      },
      {
        inputs: {
          A: "1111000011110000",
          B: "0000111100001111",
          C: "1010101010101010",
          D: "0101010101010101",
          SEL: "10",
        },
        outputs: { OUT: "1010101010101010" },
      },
      {
        inputs: {
          A: "1111111111111111",
          B: "0000000000000000",
          C: "0000000000000000",
          D: "0000000000000000",
          SEL: "00",
        },
        outputs: { OUT: "1111111111111111" },
      },
    ],
    theory: [
      "Mux4Way16 is Mux4Way op busbreedte 16: twee select-bits kiezen tussen vier woorden.",
      "Essentieel in RAM: lees één van vier banken op basis van de lage adresbits.",
    ],
  },
  {
    id: "mux8way16",
    phase: "Project 1",
    title: "Build Mux8Way16",
    names: ["Mux8Way16"],
    inputs: 9,
    outputs: 1,
    description: "Kies één van acht 16-bit bussen met een 3-bit SEL (000=A … 111=H).",
    verification: "combinational",
    template: {
      inputs: [
        { name: "A", width: 16 },
        { name: "B", width: 16 },
        { name: "C", width: 16 },
        { name: "D", width: 16 },
        { name: "E", width: 16 },
        { name: "F", width: 16 },
        { name: "G", width: 16 },
        { name: "H", width: 16 },
        { name: "SEL", width: 3 },
      ],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: [
      "Twee Mux4Way16’en (A–D en E–H) op SEL[1:0], daarna Mux16 op SEL[2].",
      "Pinlabels exact A…H en SEL.",
    ],
    tests: (() => {
      const words = {
        A: "0000000000000001",
        B: "0000000000000010",
        C: "0000000000000100",
        D: "0000000000001000",
        E: "0000000000010000",
        F: "0000000000100000",
        G: "0000000001000000",
        H: "0000000010000000",
      };
      return [
        { inputs: { ...words, SEL: "000" }, outputs: { OUT: words.A } },
        { inputs: { ...words, SEL: "001" }, outputs: { OUT: words.B } },
        { inputs: { ...words, SEL: "010" }, outputs: { OUT: words.C } },
        { inputs: { ...words, SEL: "011" }, outputs: { OUT: words.D } },
        { inputs: { ...words, SEL: "100" }, outputs: { OUT: words.E } },
        { inputs: { ...words, SEL: "101" }, outputs: { OUT: words.F } },
        { inputs: { ...words, SEL: "110" }, outputs: { OUT: words.G } },
        { inputs: { ...words, SEL: "111" }, outputs: { OUT: words.H } },
      ];
    })(),
    theory: [
      "Mux8Way16 adresseert acht woorden met drie select-bits — de leeskant van RAM8.",
      "Bouw hiërarchisch: hergebruik Mux4Way16 i.p.v. alles plat uit te tekenen.",
    ],
  },
  {
    id: "dmux8way",
    phase: "Project 1",
    title: "Build DMux8Way",
    names: ["DMux8Way"],
    inputs: 2,
    outputs: 8,
    description: "Stuur 1-bit IN naar precies één van acht outputs (A–H) op basis van 3-bit SEL.",
    verification: "combinational",
    template: {
      inputs: ["IN", { name: "SEL", width: 3 }],
      outputs: ["A", "B", "C", "D", "E", "F", "G", "H"],
    },
    hints: [
      "Eerst DMux op SEL[2], daarna per tak een DMux4Way op SEL[1:0].",
      "Alleen de geselecteerde output mag IN volgen; de rest blijft 0.",
    ],
    tests: [
      {
        inputs: { IN: "1", SEL: "000" },
        outputs: { A: "1", B: "0", C: "0", D: "0", E: "0", F: "0", G: "0", H: "0" },
      },
      {
        inputs: { IN: "1", SEL: "001" },
        outputs: { A: "0", B: "1", C: "0", D: "0", E: "0", F: "0", G: "0", H: "0" },
      },
      {
        inputs: { IN: "1", SEL: "010" },
        outputs: { A: "0", B: "0", C: "1", D: "0", E: "0", F: "0", G: "0", H: "0" },
      },
      {
        inputs: { IN: "1", SEL: "011" },
        outputs: { A: "0", B: "0", C: "0", D: "1", E: "0", F: "0", G: "0", H: "0" },
      },
      {
        inputs: { IN: "1", SEL: "100" },
        outputs: { A: "0", B: "0", C: "0", D: "0", E: "1", F: "0", G: "0", H: "0" },
      },
      {
        inputs: { IN: "1", SEL: "111" },
        outputs: { A: "0", B: "0", C: "0", D: "0", E: "0", F: "0", G: "0", H: "1" },
      },
      {
        inputs: { IN: "0", SEL: "101" },
        outputs: { A: "0", B: "0", C: "0", D: "0", E: "0", F: "0", G: "0", H: "0" },
      },
    ],
    theory: [
      "DMux8Way is de schrijfkant van RAM8: SEL kiest welke cel de LOAD mag zien.",
      "Combineer met Mux8Way16 voor een complete 8-woord geheugenbank.",
    ],
  },
  {
    id: "half-adder",
    phase: "Project 2",
    title: "Build Half Adder",
    names: ["Half Adder", "HalfAdder"],
    inputs: 2,
    outputs: 2,
    description: "Bouw SUM en CARRY als aparte outputs.",
    verification: "combinational",
    template: { inputs: ["A", "B"], outputs: ["SUM", "CARRY"] },
    hints: ["SUM werkt als XOR van A en B.", "CARRY werkt als AND van A en B."],
    tests: [
      { inputs: { A: "0", B: "0" }, outputs: { SUM: "0", CARRY: "0" } },
      { inputs: { A: "0", B: "1" }, outputs: { SUM: "1", CARRY: "0" } },
      { inputs: { A: "1", B: "0" }, outputs: { SUM: "1", CARRY: "0" } },
      { inputs: { A: "1", B: "1" }, outputs: { SUM: "0", CARRY: "1" } },
    ],
    theory: [
      "Binaire optelling: 0+0=0, 0+1=1, 1+0=1, maar 1+1=10 (twee bits: som=0, overdracht=1). De Half Adder berekent beide bits apart.",
      "SUM is de 'eenhedenkolom': XOR(A,B). CARRY is de 'overdracht naar de volgende kolom': AND(A,B).",
      "Waarom 'half'? Omdat hij geen carry-IN heeft. Je kunt hem alleen gebruiken voor de minst significante bit (rechts). Voor alle andere bits heb je de Full Adder nodig.",
    ],
  },
  {
    id: "full-adder",
    phase: "Project 2",
    title: "Build Full Adder",
    names: ["Full Adder", "FullAdder"],
    inputs: 3,
    outputs: 2,
    description: "Combineer adders tot een volledige 1-bit adder met carry-in en carry-out.",
    verification: "combinational",
    template: { inputs: ["A", "B", "CIN"], outputs: ["SUM", "COUT"] },
    hints: [
      "Gebruik twee half adders of een eigen equivalent.",
      "COUT is hoog zodra minstens twee inputs hoog zijn.",
    ],
    tests: [
      { inputs: { A: "0", B: "0", CIN: "0" }, outputs: { SUM: "0", COUT: "0" } },
      { inputs: { A: "0", B: "1", CIN: "0" }, outputs: { SUM: "1", COUT: "0" } },
      { inputs: { A: "1", B: "0", CIN: "1" }, outputs: { SUM: "0", COUT: "1" } },
      { inputs: { A: "1", B: "1", CIN: "0" }, outputs: { SUM: "0", COUT: "1" } },
      { inputs: { A: "1", B: "1", CIN: "1" }, outputs: { SUM: "1", COUT: "1" } },
    ],
    theory: [
      "De Full Adder telt drie bits op: A, B en een carry-in (CIN) van de vorige bit-positie. Dit maakt kettingen van adders mogelijk.",
      "Implementatie met twee Half Adders: Stap 1: Half Adder op A en B → geeft SUM1 en CARRY1. Stap 2: Half Adder op SUM1 en CIN → geeft SUM en CARRY2. COUT = CARRY1 OR CARRY2.",
      "Dit is de kern van elke processor: door Full Adders aan te rijgen (ripple-carry) bouw je een adder voor elk gewenst aantal bits. Add4 en Add16 zijn simpelweg vier of zestien Full Adders in serie.",
    ],
  },
  {
    id: "add4",
    phase: "Project 2",
    title: "Build Add4",
    names: ["Add4", "Adder4"],
    inputs: 2,
    outputs: 1,
    description: "Opteller voor twee 4-bit getallen. Overflow wordt genegeerd (geen carry-out).",
    verification: "combinational",
    template: {
      inputs: [{ name: "A", width: 4 }, { name: "B", width: 4 }],
      outputs: [{ name: "OUT", width: 4 }],
    },
    hints: [
      "Sla eerst je Half Adder en Full Adder chips op als je die nog nodig hebt.",
      "Gebruik Splitters (width=4, highWidth=1) om A en B bit voor bit op te splitsen.",
      "Bit 3 (MSB links): begin met een Half Adder (geen carry-in).",
      "Bits 2, 1, 0: Full Adder met carry-in van de vorige stap.",
      "Gebruik een Joiner om de vier SUM-bits weer samen te voegen tot OUT[4].",
    ],
    tests: [
      { inputs: { A: "0000", B: "0000" }, outputs: { OUT: "0000" } },
      { inputs: { A: "0001", B: "0001" }, outputs: { OUT: "0010" } },
      { inputs: { A: "0011", B: "0001" }, outputs: { OUT: "0100" } },
      { inputs: { A: "1010", B: "0101" }, outputs: { OUT: "1111" } },
      { inputs: { A: "1111", B: "0001" }, outputs: { OUT: "0000" } },
      { inputs: { A: "0110", B: "0011" }, outputs: { OUT: "1001" } },
      { inputs: { A: "0100", B: "0100" }, outputs: { OUT: "1000" } },
    ],
    theory: [
      "Add4 rijgt vier adders aaneen: dit heet een ripple-carry adder. De carry 'rimpelt' van rechts (LSB) naar links (MSB), net zoals je met de hand optelt.",
      "Bit-volgorde in dit systeem: de meest significante bit (MSB) staat links. 'A = 0110' betekent 6 in decimaal (0·8 + 1·4 + 1·2 + 0·1). Gebruik de Inspector om de breedte van een pin in te stellen.",
      "Overflow: 4 bits kunnen maar waarden van 0 tot 15 bevatten. Als de som 16 of hoger is, 'wrapet' het terug: 15+1 = 0 (de carry-out van de MSB wordt genegeerd). In echte computers wordt deze carry bijgehouden in een statusregister.",
      "Voor Add16 (nand2tetris origineel) doe je precies hetzelfde maar met 16 bits. Het principe is identiek.",
    ],
  },
  {
    id: "inc4",
    phase: "Project 2",
    title: "Build Inc4",
    names: ["Inc4", "Incrementer4"],
    inputs: 1,
    outputs: 1,
    description: "Verhoog een 4-bit getal met 1. Overflow wraps terug naar 0.",
    verification: "combinational",
    template: {
      inputs: [{ name: "IN", width: 4 }],
      outputs: [{ name: "OUT", width: 4 }],
    },
    hints: [
      "Makkelijkste route: gebruik je Add4-chip met A=IN en B=een Switch (width=4, value=0001).",
      "Directe bouw: de LSB (bit 0, rechts) toggelt altijd. Gebruik een NOT-gate.",
      "Bit 1 flips alleen als bit 0 was '1' (carry). Bit 2 flips alleen als bits 0 én 1 allebei '1' waren.",
    ],
    tests: [
      { inputs: { IN: "0000" }, outputs: { OUT: "0001" } },
      { inputs: { IN: "0001" }, outputs: { OUT: "0010" } },
      { inputs: { IN: "0011" }, outputs: { OUT: "0100" } },
      { inputs: { IN: "0111" }, outputs: { OUT: "1000" } },
      { inputs: { IN: "1111" }, outputs: { OUT: "0000" } },
      { inputs: { IN: "1010" }, outputs: { OUT: "1011" } },
      { inputs: { IN: "1000" }, outputs: { OUT: "1001" } },
    ],
    theory: [
      "Incrementeren is een speciaal geval van optellen: +1. In binair betekent dit dat je de chain van carries van rechts naar links kunt volgen.",
      "Patroon: de LSB (bit 0) toggelt altijd bij +1. Bit 1 toggelt alleen als bit 0 een carry gaf (bit 0 was 1). Bit 2 toggelt als bits 0 én 1 allebei 1 waren. Enzovoort.",
      "Inc4 is cruciaal in processoren: de programmateller (PC) telt bij elke klokcyclus op met 1 om naar de volgende instructie te verwijzen.",
    ],
  },
  {
    id: "dff",
    phase: "Project 3",
    title: "Build Bit (DFF + LOAD)",
    names: ["Bit"],
    inputs: 3,
    outputs: 1,
    description:
      "1-bit geheugencel met load: alleen bij LOAD=1 én een CLK-tick neemt OUT de waarde van IN over; anders houdt hij de oude waarde.",
    verification: "sequential-script",
    template: { inputs: ["IN", "LOAD", "CLK"], outputs: ["OUT"] },
    hints: [
      "In deze app is de builtin Register-node de DFF-primitieve: bij CLK=1 kopieert hij D→Q.",
      "Twee bouwroutes: (1) MUX vóór D (LOAD ? IN : OUT), of (2) eenvoudiger — D=IN en poort de klok: CLK_reg = CLK AND LOAD.",
      "Tip: route (2) vermijdt een combinatorische lus terug naar Q; verbind OUT gewoon met Q.",
    ],
    script: [
      { tick: true, inputs: { IN: "0", LOAD: "0", CLK: "0" } },
      { expect: { OUT: "0" }, inputs: { IN: "0", LOAD: "0", CLK: "0" } },
      { tick: true, inputs: { IN: "1", LOAD: "1", CLK: "1" } },
      { tick: true, inputs: { IN: "0", LOAD: "0", CLK: "0" } },
      { expect: { OUT: "1" }, inputs: { IN: "0", LOAD: "0", CLK: "0" } },
      { tick: true, inputs: { IN: "0", LOAD: "0", CLK: "1" } },
      { expect: { OUT: "1" }, inputs: { IN: "0", LOAD: "0", CLK: "1" } },
      { tick: true, inputs: { IN: "0", LOAD: "0", CLK: "0" } },
      { tick: true, inputs: { IN: "0", LOAD: "1", CLK: "1" } },
      { tick: true, inputs: { IN: "1", LOAD: "0", CLK: "0" } },
      { expect: { OUT: "0" }, inputs: { IN: "1", LOAD: "0", CLK: "0" } },
      { tick: true, inputs: { IN: "1", LOAD: "0", CLK: "1" } },
      { expect: { OUT: "0" }, inputs: { IN: "1", LOAD: "0", CLK: "1" } },
    ],
    theory: [
      "Een D-flip-flop (DFF) is de kleinste geheugenschakeling: hij bewaart één bit tot de volgende klokpuls. Combinationele poorten hebben geen geheugen; zonder DFF geen registers, geen RAM, geen CPU.",
      "In Forge Logic is de ingebouwde Register-node precies die DFF-primitieve: zolang CLK=1 (tijdens een tick) wordt D overgenomen naar Q; bij CLK=0 blijft Q ongewijzigd. RST op de node heeft prioriteit, maar in deze les gebruik je die niet.",
      "Het Nand2Tetris-Bit bouwt er LOAD omheen: als LOAD=0 moet de DFF zichzelf vasthouden (D←Q), als LOAD=1 mag IN binnenkomen (D←IN). Dat is één MUX vóór de DFF.",
      "Daarna schaal je op: zestien Bits → Register16; acht Registers + adressering → RAM8.",
    ],
  },
  {
    id: "register-chip",
    phase: "Project 3",
    title: "Build Register (Bit)",
    names: ["Register", "Reg1"],
    inputs: 3,
    outputs: 1,
    description: "1-bit register: neemt de waarde van D over op CLK=1, en reset op RST=1.",
    verification: "sequential-register",
    template: { inputs: ["D", "CLK", "RST"], outputs: ["Q"] },
    hints: [
      "Gebruik D, CLK en RST als inputs en Q als output.",
      "Na een step met CLK=1 moet Q de waarde van D overnemen.",
      "Bij RST=1 moet Q terug naar 0 (RST heeft hogere prioriteit).",
      "Gebruik een Register-node als geheugen. Verbind D en CLK direct.",
    ],
    theory: [
      "Na de Bit-les (DFF + LOAD) oefen je hier de kale Register/DFF-interface met expliciete RST: D, CLK, RST → Q.",
      "Werking: op CLK=1 (tijdens een tick) kopieert het register D naar zijn interne opslag. Bij CLK=0 verandert er niets.",
      "RST heeft hogere prioriteit dan CLK: als RST=1 wordt de opgeslagen waarde ongeacht CLK naar 0 gezet.",
      "Gebruik de ingebouwde Register-node. 'Step Registers' in de toolbar simuleert één tick.",
    ],
  },
  {
    id: "register16",
    phase: "Project 3",
    title: "Build Register16",
    names: ["Register16", "Reg16"],
    inputs: 3,
    outputs: 1,
    description:
      "16-bit register met LOAD: bij LOAD=1 en CLK-tick wordt IN overgenomen; anders blijft OUT gelijk.",
    verification: "sequential-script",
    template: {
      inputs: [{ name: "IN", width: 16 }, "LOAD", "CLK"],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: [
      "Gebruik een Register-node met width=16, of zestien Bit-chips.",
      "LOAD-MUX op busniveau: Mux16(OUT, IN, LOAD) → D van het register.",
      "Zelfde tick-semantiek als Bit: alleen LOAD=1 én CLK=1 schrijft.",
    ],
    script: (() => {
      const z = "0".repeat(16);
      const w = "0000000000000101";
      const w2 = "1111000011110000";
      return [
        { tick: true, inputs: { IN: z, LOAD: "0", CLK: "0" } },
        { expect: { OUT: z }, inputs: { IN: z, LOAD: "0", CLK: "0" } },
        { tick: true, inputs: { IN: w, LOAD: "1", CLK: "1" } },
        { tick: true, inputs: { IN: z, LOAD: "0", CLK: "0" } },
        { expect: { OUT: w }, inputs: { IN: z, LOAD: "0", CLK: "0" } },
        { tick: true, inputs: { IN: w2, LOAD: "0", CLK: "1" } },
        { expect: { OUT: w }, inputs: { IN: w2, LOAD: "0", CLK: "1" } },
        { tick: true, inputs: { IN: w2, LOAD: "0", CLK: "0" } },
        { tick: true, inputs: { IN: w2, LOAD: "1", CLK: "1" } },
        { tick: true, inputs: { IN: z, LOAD: "0", CLK: "0" } },
        { expect: { OUT: w2 }, inputs: { IN: z, LOAD: "0", CLK: "0" } },
      ];
    })(),
    theory: [
      "Register16 is Bit × 16: één LOAD en één CLK sturen alle bits tegelijk.",
      "In de HACK-CPU zijn A- en D-register precies zulke 16-bit registers met load-stuurbits uit de instructie.",
      "Je hebt nu de brug van DFF → Bit → Register16; daarna volgt de PC en uiteindelijk RAM.",
    ],
  },
  {
    id: "pc",
    phase: "Project 3",
    title: "Build PC",
    names: ["PC", "ProgramCounter"],
    inputs: 4,
    outputs: 1,
    description: "Programmateller: RST reset naar 0, LOAD laadt IN, INC telt op. Prioriteit: RST > LOAD > INC.",
    verification: "sequential-counter",
    template: { inputs: ["IN", "LOAD", "INC", "RST"], outputs: ["OUT"] },
    hints: [
      "Gebruik een Register-node als geheugen voor de huidige waarde (OUT = Q van de register).",
      "Bereken de 'volgende waarde' combinationeel: NOT(OUT) als INC, IN als LOAD, 0 als RST.",
      "Gebruik MUX-chips om prioriteit af te handelen: begin met (INC ? NOT(OUT) : OUT), dan (LOAD ? IN : vorige), dan (RST ? 0 : vorige).",
      "Verbind de einduitkomst met D van de Register-node en gebruik CLK om stappen te zetten.",
    ],
    theory: [
      "De programmateller (PC) is een speciaal register dat bijhoudt welke instructie de processor als volgende uitvoert. Bij elke klokcyclus telt hij normaal op met 1 (INC).",
      "Drie bijzondere situaties onderbreken het tellen: RST (reset naar 0, bijv. bij opstarten), LOAD (spring naar een specifiek adres, bijv. bij een jump-instructie), en gewoon wachten (geen INC, OUT blijft).",
      "Prioriteitsvolgorde RST > LOAD > INC is essentieel: een reset moet altijd winnen. Implementeer dit als geneste MUX'en van laag naar hoog prioriteit.",
      "De PC illustreert hoe combinationele logica (de 'volgende waarde berekenen') en sequentiële logica (de Register-node) samenwerken: de combinationele laag bepaalt WAT er opgeslagen wordt, de register bepaalt WANNEER.",
    ],
  },
  {
    id: "add16",
    phase: "Project 4",
    title: "Build Add16",
    names: ["Add16", "Adder16"],
    inputs: 2,
    outputs: 1,
    description: "Ripple-carry optelling voor twee 16-bit getallen (overflow/carry-out wordt genegeerd, zoals Add4).",
    verification: "combinational",
    template: {
      inputs: [{ name: "A", width: 16 }, { name: "B", width: 16 }],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: [
      "Kopieer het Add4-patroon: Full Adders in keten, Splitters/Joiners voor bussen.",
      "MSB staat links in de bitstring.",
    ],
    tests: [
      { inputs: { A: "0000000000000000", B: "0000000000000000" }, outputs: { OUT: "0000000000000000" } },
      { inputs: { A: "0000000000000001", B: "0000000000000001" }, outputs: { OUT: "0000000000000010" } },
      { inputs: { A: "0000000000000011", B: "0000000000000001" }, outputs: { OUT: "0000000000000100" } },
      { inputs: { A: "1010101010101010", B: "0101010101010101" }, outputs: { OUT: "1111111111111111" } },
      { inputs: { A: "1111111111111111", B: "0000000000000001" }, outputs: { OUT: "0000000000000000" } },
      { inputs: { A: "0000000000000110", B: "0000000000000011" }, outputs: { OUT: "0000000000001001" } },
      { inputs: { A: "0000000000000100", B: "0000000000000100" }, outputs: { OUT: "0000000000001000" } },
    ],
    theory: [
      "Add16 is dezelfde structuur als Add4: zestien Full Adders (of zestien keer je eigen 1-bit adder) met carry tussen de posities.",
      "Dit is de kern van de ALU: zodra je Add16 hebt, kun je optellen in één klokcyclus (plus eventuele carry-lookahead in echte CPUs).",
    ],
  },
  {
    id: "inc16",
    phase: "Project 4",
    title: "Build Inc16",
    names: ["Inc16", "Incrementer16"],
    inputs: 1,
    outputs: 1,
    description: "Verhoog een 16-bit waarde met 1; overflow wrapt naar 0.",
    verification: "combinational",
    template: {
      inputs: [{ name: "IN", width: 16 }],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: ["Hergebruik Add16 met B=0000000000000001 of bouw een carry-keten.", "Test expliciet IN=1111111111111111 → OUT=0."],
    tests: [
      { inputs: { IN: "0000000000000000" }, outputs: { OUT: "0000000000000001" } },
      { inputs: { IN: "0000000000000001" }, outputs: { OUT: "0000000000000010" } },
      { inputs: { IN: "0000000000000011" }, outputs: { OUT: "0000000000000100" } },
      { inputs: { IN: "0000000000000111" }, outputs: { OUT: "0000000000001000" } },
      { inputs: { IN: "1111111111111111" }, outputs: { OUT: "0000000000000000" } },
      { inputs: { IN: "1010101010101010" }, outputs: { OUT: "1010101010101011" } },
      { inputs: { IN: "1000000000000000" }, outputs: { OUT: "1000000000000001" } },
    ],
    theory: [
      "Inc16 is hoe een programmateller (PC) in stappen vooruit gaat: elke instructie is +1 op het huidige adres.",
      "In een echte CPU wordt Inc16 vaak samengevoegd met branch-logica; hier oefen je het pure increment.",
    ],
  },
  {
    id: "alu",
    phase: "Project 4",
    title: "Build ALU (16-bit)",
    names: ["ALU"],
    inputs: 8,
    outputs: 3,
    description:
      "nand2tetris-stijl ALU: stuur X en Y met zx,nx,zy,ny,f,no; lees OUT (16), zr (1 als OUT==0), ng (1 als MSB van OUT gezet is).",
    verification: "combinational",
    template: {
      inputs: [
        { name: "X", width: 16 },
        { name: "Y", width: 16 },
        "ZX",
        "NX",
        "ZY",
        "NY",
        "F",
        "NO",
      ],
      outputs: [{ name: "OUT", width: 16 }, "ZR", "NG"],
    },
    hints: [
      "Bouw eerst hulpfuncties: zero/negate op X en Y, dan MUX tussen AND en ADD, dan optionele NOT op het resultaat.",
      "zr = reduction-NOR van alle OUT-bits; ng = meest significante bit van OUT.",
      "Pinlabels exact: X, Y, ZX, NX, ZY, NY, F, NO, OUT, ZR, NG.",
    ],
    tests: ALU_TESTS,
    theory: [
      "De HACK-ALU is het hart van de CPU uit het boek: één circuit voor AND, ADD, invert, vergelijken, en constanten.",
      "De vlaggen zr en ng zijn precies wat je nodig hebt voor conditionele jumps (jump if zero / jump if negative).",
      "Referentie-implementatie voor de tests staat in src/sim/hack-alu.js — ideaal om je eigen uitkomsten tegen te houden tijdens het bouwen.",
    ],
  },
  {
    id: "instruction-decoder",
    phase: "Project 4",
    title: "Build Instruction Decoder",
    names: ["InstrDecoder", "Decoder", "InstructionDecoder"],
    inputs: 1,
    outputs: 4,
    description:
      "Splits een 16-bit HACK-instructie in stuurbits: isA (1 als MSB=0), comp (7), dest (3), jump (3).",
    verification: "combinational",
    template: {
      inputs: [{ name: "IN", width: 16 }],
      outputs: [
        "isA",
        { name: "comp", width: 7 },
        { name: "dest", width: 3 },
        { name: "jump", width: 3 },
      ],
    },
    hints: [
      "A-instructie: MSB=0 → isA=1. C-instructie: MSB=1 → isA=0.",
      "C-formaat: 111 a cccccc ddd jjj — comp = a+cccccc (bits 12–6), dest = bits 5–3, jump = bits 2–0.",
      "Gebruik Splitter-ketens of bit-selectie; de velden zijn pure slices van IN.",
    ],
    tests: [
      (() => {
        const d = decodeHackInstruction(HACK_INSTR.at21);
        return { inputs: { IN: HACK_INSTR.at21 }, outputs: d };
      })(),
      (() => {
        const d = decodeHackInstruction(HACK_INSTR.dEqA);
        return { inputs: { IN: HACK_INSTR.dEqA }, outputs: d };
      })(),
      (() => {
        const d = decodeHackInstruction(HACK_INSTR.dEqDPlusM);
        return { inputs: { IN: HACK_INSTR.dEqDPlusM }, outputs: d };
      })(),
      (() => {
        const d = decodeHackInstruction(HACK_INSTR.jmp);
        return { inputs: { IN: HACK_INSTR.jmp }, outputs: d };
      })(),
      (() => {
        const d = decodeHackInstruction(HACK_INSTR.aEqD);
        return { inputs: { IN: HACK_INSTR.aEqD }, outputs: d };
      })(),
      (() => {
        const d = decodeHackInstruction(HACK_INSTR.at7);
        return { inputs: { IN: HACK_INSTR.at7 }, outputs: d };
      })(),
      (() => {
        const d = decodeHackInstruction(Z16);
        return { inputs: { IN: Z16 }, outputs: d };
      })(),
      (() => {
        const d = decodeHackInstruction(HACK_INSTR.dEqDPlusA);
        return { inputs: { IN: HACK_INSTR.dEqDPlusA }, outputs: d };
      })(),
    ],
    theory: [
      "Elke HACK-instructie is 16 bits. Bit 15 onderscheidt A-instructies (0vvvvvvvvvvvvvvv) van C-instructies (111accccccdddjjj).",
      "De decoder is combinationeel: hij snijdt alleen velden — geen geheugen. Later stuurt de CPU met deze bits de ALU, registers en PC.",
      "comp (7 bits) voedt de ALU-stuurbits; dest bepaalt of A/D/M laden; jump combineert met zr/ng voor branches.",
    ],
  },
  {
    id: "alu-with-registers",
    phase: "Project 4",
    title: "Build ALU + Registers",
    names: ["AluRegs", "ALURegs", "MiniDatapath"],
    inputs: 10,
    outputs: 5,
    description:
      "Mini-datapad: A- en D-register + ALU. Y van de ALU is A; X is D. Laad A met A_IN, laad D vanuit ALU-out.",
    verification: "sequential-script",
    template: {
      inputs: [
        { name: "A_IN", width: 16 },
        "A_LOAD",
        "D_LOAD",
        "ZX",
        "NX",
        "ZY",
        "NY",
        "F",
        "NO",
        "CLK",
      ],
      outputs: [
        { name: "A", width: 16 },
        { name: "D", width: 16 },
        { name: "ALUOUT", width: 16 },
        "ZR",
        "NG",
      ],
    },
    hints: [
      "Register16 (of breed register) voor A en D; CLK poorten met A_LOAD / D_LOAD.",
      "ALU: X=D, Y=A, stuurbits ZX…NO; ALUOUT/ZR/NG combinationeel.",
      "D laadt ALUOUT wanneer D_LOAD=1; A laadt A_IN wanneer A_LOAD=1.",
    ],
    script: (() => {
      const z = Z16;
      const v7 = "0000000000000111";
      const v3 = "0000000000000011";
      // D=A flags: zx=1,nx=1,zy=0,ny=0,f=1,no=0 → OUT=A
      const dEqA = computeHackAlu(z, v7, { zx: "1", nx: "1", zy: "0", ny: "0", f: "1", no: "0" });
      // D=D+A with D=7, A=3
      const dPlusA = computeHackAlu(v7, v3, { zx: "0", nx: "0", zy: "0", ny: "0", f: "1", no: "0" });
      return [
        { tick: true, inputs: { A_IN: z, A_LOAD: "0", D_LOAD: "0", ZX: "0", NX: "0", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "0" } },
        { tick: true, inputs: { A_IN: v7, A_LOAD: "1", D_LOAD: "0", ZX: "1", NX: "1", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "1" } },
        { tick: true, inputs: { A_IN: v7, A_LOAD: "0", D_LOAD: "0", ZX: "1", NX: "1", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "0" } },
        {
          expect: { A: v7, ALUOUT: dEqA.OUT, ZR: dEqA.zr, NG: dEqA.ng },
          inputs: { A_IN: v7, A_LOAD: "0", D_LOAD: "0", ZX: "1", NX: "1", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "0" },
        },
        { tick: true, inputs: { A_IN: v7, A_LOAD: "0", D_LOAD: "1", ZX: "1", NX: "1", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "1" } },
        { tick: true, inputs: { A_IN: v7, A_LOAD: "0", D_LOAD: "0", ZX: "1", NX: "1", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "0" } },
        {
          expect: { A: v7, D: v7 },
          inputs: { A_IN: v7, A_LOAD: "0", D_LOAD: "0", ZX: "1", NX: "1", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "0" },
        },
        { tick: true, inputs: { A_IN: v3, A_LOAD: "1", D_LOAD: "0", ZX: "0", NX: "0", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "1" } },
        { tick: true, inputs: { A_IN: v3, A_LOAD: "0", D_LOAD: "0", ZX: "0", NX: "0", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "0" } },
        {
          expect: { A: v3, D: v7, ALUOUT: dPlusA.OUT, ZR: dPlusA.zr, NG: dPlusA.ng },
          inputs: { A_IN: v3, A_LOAD: "0", D_LOAD: "0", ZX: "0", NX: "0", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "0" },
        },
        { tick: true, inputs: { A_IN: v3, A_LOAD: "0", D_LOAD: "1", ZX: "0", NX: "0", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "1" } },
        { tick: true, inputs: { A_IN: v3, A_LOAD: "0", D_LOAD: "0", ZX: "0", NX: "0", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "0" } },
        {
          expect: { D: dPlusA.OUT, A: v3 },
          inputs: { A_IN: v3, A_LOAD: "0", D_LOAD: "0", ZX: "0", NX: "0", ZY: "0", NY: "0", F: "1", NO: "0", CLK: "0" },
        },
      ];
    })(),
    theory: [
      "Dit is de kern van de HACK-datapath: A en D voeden de ALU; de ALU-uitkomst kan terug naar D (of later naar A/M).",
      "De stuurbits ZX…NO komen later uit de instructie-decoder (comp-veld). Hier zet je ze nog met de hand.",
      "Verwachte ALU-uitkomsten in de tests komen uit computeHackAlu — dezelfde referentie als de ALU-les.",
    ],
  },
  {
    id: "ram8",
    phase: "Project 5",
    title: "Build RAM8",
    names: ["RAM8"],
    inputs: 4,
    outputs: 1,
    description:
      "8 woorden × 16 bit: bij LOAD=1 en een CLK-tick schrijf je IN naar geheugen[ADDR]; OUT toont altijd geheugen[ADDR] (combinatoir uitlezen). ADDR is 3-bit.",
    verification: "sequential-script",
    template: {
      inputs: [
        { name: "IN", width: 16 },
        "LOAD",
        { name: "ADDR", width: 3 },
        "CLK",
      ],
      outputs: [{ name: "OUT", width: 16 }],
    },
    hints: [
      "Gebruik acht keer een 16-bit register (of je eigen brede register-chip) en een DMux8Way/Mux8Way-achtige adresdecodering.",
      "Verbind de externe CLK-input met de Register CLK-ingangen; Submit gebruikt ticks met jouw CLK-pin.",
      "Zorg dat OUT de geselecteerde cel combinationeel volgt.",
    ],
    script: (() => {
      const z = Z16;
      const w = "0000000000000101";
      return [
        { tick: true, inputs: { IN: z, LOAD: "0", ADDR: "000", CLK: "0" } },
        { expect: { OUT: z }, inputs: { IN: z, LOAD: "0", ADDR: "000", CLK: "0" } },
        { tick: true, inputs: { IN: w, LOAD: "1", ADDR: "000", CLK: "1" } },
        { tick: true, inputs: { IN: z, LOAD: "0", ADDR: "000", CLK: "0" } },
        { expect: { OUT: w }, inputs: { IN: z, LOAD: "0", ADDR: "000", CLK: "0" } },
        { expect: { OUT: z }, inputs: { LOAD: "0", ADDR: "001", CLK: "0" } },
        { tick: true, inputs: { IN: w, LOAD: "1", ADDR: "001", CLK: "1" } },
        { tick: true, inputs: { IN: z, LOAD: "0", ADDR: "001", CLK: "0" } },
        { expect: { OUT: w }, inputs: { LOAD: "0", ADDR: "001", CLK: "0" } },
        { expect: { OUT: z }, inputs: { LOAD: "0", ADDR: "000", CLK: "0" } },
      ];
    })(),
    theory: [
      "RAM8 is de eerste echte geheugenbank: een adres kiest welk woord je leest of beschrijft.",
      "Je hebt de bouwstenen al: DFF→Bit (LOAD), Register16, en Mux8Way16/DMux8Way voor adressering.",
      "In hardware simulatoren is 'load' synchroon met de klok: pas na een tick met LOAD=1 verandert de cel.",
      "Bouw acht Register16’s (of Bit-rijen), decodeer ADDR met DMux8Way naar acht load-lijnen, en kies de uitgelezen bus met Mux8Way16.",
    ],
  },
  {
    id: "mod4-counter",
    phase: "Project 5",
    title: "Build Mod4 teller",
    names: ["Mod4", "Mod4Counter", "Counter2"],
    inputs: 2,
    outputs: 1,
    description:
      "Sequentieel bouwblok: 2-bit teller. RST=1 zet terug naar 00; elke tick met CLK=1 (na stabiele inputs) telt +1 mod 4.",
    verification: "sequential-script",
    template: { inputs: ["RST", "CLK"], outputs: [{ name: "OUT", width: 2 }] },
    hints: [
      "Een register van 2 bits of een keten van toggles + AND voor carry.",
      "Houd rekening met de Submit-sequentie: eerst RST-pulsen, daarna losse CLK-ticks om te tellen.",
    ],
    script: [
      { tick: true, inputs: { RST: "1", CLK: "0" } },
      { tick: true, inputs: { RST: "1", CLK: "1" } },
      { tick: true, inputs: { RST: "1", CLK: "0" } },
      { expect: { OUT: "00" }, inputs: { RST: "0", CLK: "0" } },
      { tick: true, inputs: { RST: "0", CLK: "1" } },
      { expect: { OUT: "01" }, inputs: { RST: "0", CLK: "1" } },
      { tick: true, inputs: { RST: "0", CLK: "0" } },
      { tick: true, inputs: { RST: "0", CLK: "1" } },
      { expect: { OUT: "10" }, inputs: { RST: "0", CLK: "1" } },
      { tick: true, inputs: { RST: "0", CLK: "0" } },
      { tick: true, inputs: { RST: "0", CLK: "1" } },
      { expect: { OUT: "11" }, inputs: { RST: "0", CLK: "1" } },
    ],
    theory: [
      "Een mod-4 teller is een miniatuur programmateller: hij laat zien hoe state en klok samen 'stap voor stap' werken.",
      "Dit is een lichte CPU-achtige oefening: later combineer je zo’n teller met ROM en ALU tot een eenvoudige datapad.",
    ],
  },
  makeRamChallenge("ram64", "Build RAM64", ["RAM64"], 6),
  makeRamChallenge("ram512", "Build RAM512", ["RAM512"], 9),
  makeRamChallenge("ram4k", "Build RAM4K", ["RAM4K"], 12),
  makeRamChallenge("ram16k", "Build RAM16K", ["RAM16K"], 14),
  {
    id: "cpu",
    phase: "Project 5",
    title: "Build CPU",
    names: ["CPU"],
    inputs: 3,
    outputs: 4,
    description:
      "HACK CPU: inM + instruction + reset → outM, writeM, addressM (15-bit), pc (16-bit). Reset zet pc op 0; daarna telt pc op per cyclus.",
    verification: "sequential-script",
    template: {
      inputs: [
        { name: "inM", width: 16 },
        { name: "instruction", width: 16 },
        "reset",
      ],
      outputs: [
        { name: "outM", width: 16 },
        "writeM",
        { name: "addressM", width: 15 },
        { name: "pc", width: 16 },
      ],
    },
    hints: [
      "Combineer PC, A/D-registers, ALU en geheugenlogica zoals in het boek (datapath + control).",
      "Pinlabels exact: inM, instruction, reset, outM, writeM, addressM, pc.",
      "Bij reset=1 moet pc naar 0; bij reset=0 en @0-instructie telt pc op.",
    ],
    script: (() => {
      const z = Z16;
      const addr0 = "000000000000000";
      // Na @7 + D=A is D=7; na @3 is A=3; D=D+A → 10 (via computeHackAlu).
      const sumDA = computeHackAlu("0000000000000111", "0000000000000011", {
        zx: "0",
        nx: "0",
        zy: "0",
        ny: "0",
        f: "1",
        no: "0",
      });
      const addrSum = sumDA.OUT.slice(1); // addressM is 15-bit (A zonder MSB)
      return [
        { tick: true, inputs: { inM: z, instruction: z, reset: "1" } },
        { tick: true, inputs: { inM: z, instruction: z, reset: "0" } },
        {
          expect: { pc: z, addressM: addr0, writeM: "0", outM: z },
          inputs: { inM: z, instruction: z, reset: "0" },
        },
        { tick: true, inputs: { inM: z, instruction: z, reset: "0" } },
        {
          expect: { pc: "0000000000000001" },
          inputs: { inM: z, instruction: z, reset: "0" },
        },
        { tick: true, inputs: { inM: z, instruction: z, reset: "0" } },
        {
          expect: { pc: "0000000000000010" },
          inputs: { inM: z, instruction: z, reset: "0" },
        },
        // Datapath: @7 ; D=A ; @3 ; D=D+A ; A=D → addressM toont 10
        { tick: true, inputs: { inM: z, instruction: HACK_INSTR.at7, reset: "0" } },
        {
          expect: { addressM: "000000000000111" },
          inputs: { inM: z, instruction: HACK_INSTR.at7, reset: "0" },
        },
        { tick: true, inputs: { inM: z, instruction: HACK_INSTR.dEqA, reset: "0" } },
        { tick: true, inputs: { inM: z, instruction: HACK_INSTR.at3, reset: "0" } },
        {
          expect: { addressM: "000000000000011" },
          inputs: { inM: z, instruction: HACK_INSTR.at3, reset: "0" },
        },
        { tick: true, inputs: { inM: z, instruction: HACK_INSTR.dEqDPlusA, reset: "0" } },
        { tick: true, inputs: { inM: z, instruction: HACK_INSTR.aEqD, reset: "0" } },
        {
          expect: { addressM: addrSum },
          inputs: { inM: z, instruction: HACK_INSTR.aEqD, reset: "0" },
        },
        // Jump: @100 ; 0;JMP → pc := 100
        { tick: true, inputs: { inM: z, instruction: HACK_INSTR.at100, reset: "0" } },
        { tick: true, inputs: { inM: z, instruction: HACK_INSTR.jmp, reset: "0" } },
        {
          expect: { pc: HACK_INSTR.at100 },
          inputs: { inM: z, instruction: HACK_INSTR.jmp, reset: "0" },
        },
      ];
    })(),
    theory: [
      "De CPU verbindt alle Project 4/5 chips: PC telt instructies, registers bewaren state, ALU rekent, geheugen leest/schrijft.",
      "C-instructies (D=A, D=D+A, 0;JMP) vereisen een echte datapath — alleen pc++ is niet genoeg om deze tests te halen.",
      "Dit is de culminatie van Nand2Tetris — een werkende processor opgebouwd uit jouw eigen gates en chips.",
    ],
  },
  {
    id: "computer",
    phase: "Project 5",
    title: "Bouw je computer",
    names: ["Computer"],
    inputs: 2,
    outputs: 1,
    description:
      "Eindproject: koppel jouw CPU (en optioneel RAM) aan de voorgevulde ROM + Screen. Bij play moet het demo-programma pixels zetten. Pins: reset, CLK → pc.",
    verification: "sequential-script",
    template: {
      inputs: ["reset", "CLK"],
      outputs: [{ name: "pc", width: 16 }],
      nodes: [
        {
          type: "rom",
          x: 360,
          y: 80,
          config: {
            label: "ROM",
            addressWidth: 5,
            program: demoProgramBits(SCREEN_ROWS_DEMO),
          },
        },
        {
          type: "screen",
          x: 360,
          y: 320,
          config: { label: "Screen", cols: 8, rows: 8 },
        },
      ],
    },
    hints: [
      "ROM.OUT → CPU.instruction; CPU.pc (lage bits) → ROM.ADDR.",
      "Versimpelde I/O: CPU.outM → Screen.IN, writeM → WRITE, addressM[2:0] → ROW, CLK → Screen.CLK.",
      "Snapshot als chipnaam Computer; verificatie checkt screen-rijen na klokticks.",
    ],
    script: (() => {
      const pattern = "11110000";
      const steps = [
        { tick: true, inputs: { reset: "1", CLK: "1" } },
        { tick: true, inputs: { reset: "0", CLK: "0" } },
      ];
      // Drie volle cycli: elke hoog-fase schrijft de volgende rij (referentie-teller).
      for (let row = 0; row < 3; row += 1) {
        steps.push({ tick: true, inputs: { reset: "0", CLK: "1" } });
        steps.push({ tick: true, inputs: { reset: "0", CLK: "0" } });
        const expectState = {};
        for (let r = 0; r <= row; r += 1) {
          expectState[`:row${r}`] = pattern;
        }
        steps.push({
          expectState,
          inputs: { reset: "0", CLK: "0" },
        });
      }
      return steps;
    })(),
    theory: [
      "Dit is het Nand2Tetris-eindpunt: instructies uit ROM, een CPU die ze uitvoert, en zichtbare output op Screen.",
      "In Forge Logic is de Screen 8×8 en schrijf je per rij met WRITE+CLK — genoeg om 'de computer werkt' te zien.",
      "Het demo-programma staat al in de ROM-node; jij levert de datapath (CPU + bedrading).",
    ],
  },
];

/** Lesdoelen, concepten en optionele quiz — gekoppeld op challenge-id. */
const LEARNING_BY_ID = {
  nand: {
    goal: "Begrijp waarom NAND universeel is en bouw een werkende NAND-chip.",
    concepts: ["bit", "universele poort", "NAND"],
    quiz: [
      {
        question: "Wanneer geeft NAND de output 0?",
        options: ["Als minstens één input 1 is", "Alleen als beide inputs 1 zijn", "Als beide inputs 0 zijn", "Nooit"],
        answerIndex: 1,
        explain: "NAND is Not-AND: alleen AND=1 (beide inputs 1) wordt omgekeerd naar 0.",
      },
      {
        question: "Waarom start dit leerpad bij NAND?",
        options: [
          "Omdat NAND de snelste poort is",
          "Omdat elke andere poort uit alleen NAND’s kan worden gebouwd",
          "Omdat NAND geen stroom verbruikt",
          "Omdat NAND drie inputs heeft",
        ],
        answerIndex: 1,
        explain: "NAND is een universele poort: NOT, AND, OR, XOR — alles is eruit op te bouwen.",
      },
    ],
  },
  not: {
    goal: "Bouw een inverter (NOT) door NAND slim te bekabelen.",
    concepts: ["inverter", "NOT", "NAND-composiet"],
    quiz: [
      {
        question: "Hoe bouw je NOT met één NAND-gate?",
        options: [
          "Laat één input los",
          "Verbind beide NAND-inputs met dezelfde IN",
          "Zet SEL op 1",
          "Dat kan niet",
        ],
        answerIndex: 1,
        explain: "NAND(IN, IN) is gelijk aan NOT(IN).",
      },
    ],
  },
  and: {
    goal: "Maak AND door NAND te combineren met NOT.",
    concepts: ["AND", "maskeren", "composiet"],
    quiz: [
      {
        question: "Wanneer is AND(A,B) = 1?",
        options: ["Als A of B 1 is", "Alleen als A en B beide 1 zijn", "Als A ≠ B", "Altijd"],
        answerIndex: 1,
        explain: "AND is 1 uitsluitend als beide inputs hoog zijn.",
      },
      {
        question: "AND is gelijk aan…",
        options: ["NAND zonder NOT", "NOT(NAND(A,B))", "OR(A,B)", "XOR(A,B)"],
        answerIndex: 1,
        explain: "AND = NOT ∘ NAND: draai de NAND-uitkomst om.",
      },
    ],
  },
  or: {
    goal: "Bouw OR via De Morgan (NAND + NOT).",
    concepts: ["OR", "De Morgan", "parallel"],
    quiz: [
      {
        question: "Wanneer is OR(A,B) = 0?",
        options: ["Als A=1", "Alleen als A en B beide 0 zijn", "Als A ≠ B", "Nooit"],
        answerIndex: 1,
        explain: "OR is laag alleen als beide inputs laag zijn.",
      },
    ],
  },
  xor: {
    goal: "Bouw XOR: output 1 precies wanneer de inputs verschillen.",
    concepts: ["XOR", "optelling", "verschil"],
    quiz: [
      {
        question: "XOR(1,1) is…",
        options: ["1", "0", "ongedefinieerd", "2"],
        answerIndex: 1,
        explain: "XOR is 1 alleen bij verschil; gelijke inputs geven 0.",
      },
      {
        question: "Welke poort vormt de SUM-bit van een half adder?",
        options: ["AND", "OR", "XOR", "NOR"],
        answerIndex: 2,
        explain: "De eenhedenkolom van binaire optelling is XOR.",
      },
    ],
  },
  "xor-nand-only": {
    goal: "Bewijs dat XOR ook lukt met uitsluitend NAND-gates.",
    concepts: ["universele poort", "gate constraint", "NAND-only"],
    quiz: [
      {
        question: "Wat mag je op deze canvas niet gebruiken?",
        options: ["Input-pins", "Ingebouwde AND/OR/NOT/XOR-gates", "Wires", "Je eigen chips"],
        answerIndex: 1,
        explain: "Alleen ingebouwde NAND is toegestaan als gate; eigen chips mogen als ze ook NAND-only zijn.",
      },
    ],
  },
  mux: {
    goal: "Bouw een 2-weg multiplexer: SEL kiest tussen A en B.",
    concepts: ["MUX", "select", "datarouting"],
  },
  dmux: {
    goal: "Bouw een demultiplexer: stuur IN naar A of B op basis van SEL.",
    concepts: ["DMUX", "adressering", "select"],
  },
  not16: {
    goal: "Schaal NOT naar 16 bit (bitwise invert van een hele bus).",
    concepts: ["Not16", "bitwise", "16-bit"],
  },
  and16: {
    goal: "Bouw And16: bitwise AND over twee 16-bit bussen.",
    concepts: ["And16", "maskeren", "bus"],
  },
  or16: {
    goal: "Bouw Or16: bitwise OR over twee 16-bit bussen.",
    concepts: ["Or16", "bitwise", "bus"],
  },
  mux16: {
    goal: "Bouw Mux16: kies tussen twee 16-bit bussen met één select-bit.",
    concepts: ["Mux16", "datapath", "select"],
  },
  or4way: {
    goal: "Reduceer 4 bits tot 1 met OR (nuldetectie-patroon).",
    concepts: ["reduction OR", "splitter", "multi-bit"],
  },
  mux4way: {
    goal: "Kies één van vier inputs met twee select-bits.",
    concepts: ["Mux4Way", "select-boom", "2ⁿ keuzes"],
  },
  dmux4way: {
    goal: "Stuur één input naar precies één van vier outputs.",
    concepts: ["DMux4Way", "decode", "adresboom"],
  },
  or8way: {
    goal: "Bouw Or8Way: reduction-OR over 8 bits.",
    concepts: ["Or8Way", "zero-detect", "reduction"],
  },
  mux4way16: {
    goal: "Kies één van vier 16-bit woorden met een 2-bit SEL.",
    concepts: ["Mux4Way16", "bus-MUX", "RAM-lees"],
  },
  mux8way16: {
    goal: "Kies één van acht 16-bit woorden met een 3-bit SEL.",
    concepts: ["Mux8Way16", "RAM8", "hiërarchie"],
  },
  dmux8way: {
    goal: "Decodeer 3-bit SEL naar acht 1-bit schrijflijnen.",
    concepts: ["DMux8Way", "RAM-schrijf", "decode"],
  },
  "half-adder": {
    goal: "Bouw SUM (XOR) en CARRY (AND) voor 1-bit optelling zonder carry-in.",
    concepts: ["half adder", "SUM", "carry"],
  },
  "full-adder": {
    goal: "Breid de half adder uit met carry-in tot een volledige 1-bit adder.",
    concepts: ["full adder", "CIN", "COUT"],
  },
  add4: {
    goal: "Ketting full adders tot een 4-bit opteller.",
    concepts: ["ripple carry", "Add4", "bus"],
  },
  inc4: {
    goal: "Bouw een 4-bit incrementer (X + 1).",
    concepts: ["Inc4", "increment", "adder"],
  },
  "register-chip": {
    goal: "Leg de kale DFF/Register-interface bloot met D, CLK en RST.",
    concepts: ["register", "RST", "CLK"],
  },
  register16: {
    goal: "Schaal Bit op naar een 16-bit register met gedeelde LOAD.",
    concepts: ["Register16", "LOAD", "16-bit state"],
  },
  dff: {
    goal: "Begrijp de DFF-primitieve en bouw Bit met LOAD-gedrag.",
    concepts: ["DFF", "Bit", "LOAD", "state"],
  },
  pc: {
    goal: "Bouw een programmateller die kan resetten, laden en ophogen.",
    concepts: ["PC", "increment", "control"],
  },
  add16: {
    goal: "Schaal optelling naar 16 bit met dezelfde adder-ideeën.",
    concepts: ["Add16", "16-bit", "bus"],
  },
  inc16: {
    goal: "Bouw Inc16: verhoog een 16-bit waarde met 1.",
    concepts: ["Inc16", "PC-hulp", "16-bit"],
  },
  alu: {
    goal: "Implementeer de HACK-ALU met stuurbits zx/nx/zy/ny/f/no.",
    concepts: ["ALU", "zr", "ng", "HACK"],
  },
  "instruction-decoder": {
    goal: "Splits HACK-instructies in isA, comp, dest en jump.",
    concepts: ["A/C-instructie", "comp", "dest", "jump"],
  },
  "alu-with-registers": {
    goal: "Koppel A/D-registers aan de ALU tot een mini-datapad.",
    concepts: ["datapath", "A-register", "D-register"],
  },
  ram8: {
    goal: "Bouw 8 woorden × 16-bit geheugen met adresdecodering.",
    concepts: ["RAM8", "ADDR", "LOAD"],
  },
  "mod4-counter": {
    goal: "Bouw een 2-bit teller die modulo 4 telt op de klok.",
    concepts: ["teller", "mod 4", "sequentieel"],
  },
  ram64: {
    goal: "Schaal RAM8 hiërarchisch op naar 64 woorden.",
    concepts: ["RAM64", "hiërarchie", "adresbits"],
  },
  ram512: {
    goal: "Bouw RAM512 als stapeling van kleinere RAM-blokken.",
    concepts: ["RAM512", "geheugenbank"],
  },
  ram4k: {
    goal: "Bouw RAM4K met 12 adresbits.",
    concepts: ["RAM4K", "12-bit adres"],
  },
  ram16k: {
    goal: "Bouw RAM16K — het datageheugen van de HACK-machine.",
    concepts: ["RAM16K", "datageheugen"],
  },
  cpu: {
    goal: "Combineer PC, registers, ALU en geheugensturing tot een CPU.",
    concepts: ["CPU", "datapath", "instruction"],
  },
  computer: {
    goal: "Koppel ROM, CPU en Screen tot een draaiende mini-computer.",
    concepts: ["computer", "ROM", "Screen", "klok"],
  },
};

for (const challenge of CHALLENGES) {
  const learning = LEARNING_BY_ID[challenge.id];
  if (learning) {
    challenge.learning = learning;
  }
}

applyPrerequisitesToChallenges(CHALLENGES);
