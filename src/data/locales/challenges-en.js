/** Auto-extracted / maintained challenge prose. Do not put tests here. */
export default {
  "intro-light": {
    "title": "Light on",
    "description": "Case: the porch lamp may only turn on when the door is closed and the alarm is armed. Build the circuit that controls the lamp.",
    "hints": [
      "Open Parts and place the AND gate.",
      "Connect DOOR and ALARM each to one input of the AND gate.",
      "Connect the AND gate's output to LAMP, then switch DOOR and ALARM on."
    ],
    "theory": [
      "A circuit is made of parts connected by wires. Each wire carries a bit: 1 is on, 0 is off.",
      "Inputs sit on the left (here DOOR and ALARM), the output on the right (LAMP). An AND gate outputs 1 only when both inputs are 1 — exactly the rule of this case.",
      "In the next lessons you will build gates like this yourself, starting with NAND."
    ],
    "learning": {
      "goal": "Learn to place parts, connect them with wires and test your circuit.",
      "concepts": [
        "input",
        "output",
        "wire",
        "AND"
      ],
      "quiz": [
        {
          "question": "When does the lamp turn on?",
          "options": [
            "As soon as the door is closed",
            "When the door is closed and the alarm is armed",
            "When either one is on",
            "Never"
          ],
          "explain": "AND only outputs 1 when both inputs are 1.",
          "answerIndex": 1
        }
      ]
    }
  },
  "nand": {
    "title": "Build NAND",
    "description": "Make your own NAND chip without using the starter version.",
    "hints": [
      "Use two Input nodes named A and B.",
      "Create exactly one Output node named OUT.",
      "Build with existing gates, then save your chip as NAND."
    ],
    "theory": [
      "A bit is the smallest unit of information: 0 (low, false, off) or 1 (high, true, on). Everything in a computer is built from millions of these switches.",
      "A logic gate combines one or more bits into a new bit. The NAND gate (Not-AND) outputs 0 only when BOTH inputs are 1 — otherwise always 1.",
      "NAND is the universal building block: every other logic function can be built using only NAND gates. This project starts here on purpose — once you have NAND, you have everything.",
      "Build strategy: use the built-in NAND gate from the Parts bar. Connect A and B directly to the gate, and the output to your OUT pin."
    ],
    "learning": {
      "goal": "Understand why NAND is universal and build a working NAND chip.",
      "concepts": [
        "bit",
        "universal gate",
        "NAND"
      ],
      "quiz": [
        {
          "question": "When does NAND output 0?",
          "options": [
            "When at least one input is 1",
            "Only when both inputs are 1",
            "When both inputs are 0",
            "Never"
          ],
          "explain": "NAND is Not-AND: only AND=1 (both inputs 1) is inverted to 0.",
          "answerIndex": 1
        },
        {
          "question": "Why does this learning path start with NAND?",
          "options": [
            "Because NAND is the fastest gate",
            "Because every other gate can be built from NAND alone",
            "Because NAND uses no power",
            "Because NAND has three inputs"
          ],
          "explain": "NAND is a universal gate: NOT, AND, OR, XOR — everything can be built from it.",
          "answerIndex": 1
        }
      ]
    }
  },
  "not": {
    "title": "Build NOT",
    "description": "Build an inverter chip with 1 input and 1 output.",
    "hints": [
      "Use one Input and one Output.",
      "OUT must always be the inverse of IN."
    ],
    "theory": [
      "The NOT gate (inverter) flips a bit: 0 becomes 1 and 1 becomes 0. It is the simplest gate.",
      "You can build NOT from NAND: connect both NAND inputs to the same input IN. Because A=B: NAND(1,1)=0 and NAND(0,0)=1 — exactly the behavior of NOT.",
      "NOT is the foundation of all 'negative' logic: NAND, NOR, XNOR are all combinations that include NOT."
    ],
    "learning": {
      "goal": "Build an inverter (NOT) by wiring NAND cleverly.",
      "concepts": [
        "inverter",
        "NOT",
        "NAND composite"
      ],
      "quiz": [
        {
          "question": "How do you build NOT with one NAND gate?",
          "options": [
            "Leave one input disconnected",
            "Connect both NAND inputs to the same IN",
            "Set SEL to 1",
            "That is impossible"
          ],
          "explain": "NAND(IN, IN) equals NOT(IN).",
          "answerIndex": 1
        }
      ]
    }
  },
  "and": {
    "title": "Build AND",
    "description": "Build AND from your existing building blocks.",
    "hints": [
      "Use A and B as inputs and OUT as output.",
      "OUT may be 1 only when both A and B are 1."
    ],
    "theory": [
      "AND outputs 1 only when BOTH inputs are 1. In an electrical circuit: two switches in series — current flows only when both are closed.",
      "AND is literally NOT(NAND): a NAND gate followed by a NOT gate gives AND. Use your own chips!",
      "AND is fundamental for masking (filtering bits) and conditional logic in processors."
    ],
    "learning": {
      "goal": "Make AND by combining NAND with NOT.",
      "concepts": [
        "AND",
        "masking",
        "composite"
      ],
      "quiz": [
        {
          "question": "When is AND(A,B) = 1?",
          "options": [
            "When A or B is 1",
            "Only when both A and B are 1",
            "When A ≠ B",
            "Always"
          ],
          "explain": "AND is 1 only when both inputs are high.",
          "answerIndex": 1
        },
        {
          "question": "AND is equal to…",
          "options": [
            "NAND without NOT",
            "NOT(NAND(A,B))",
            "OR(A,B)",
            "XOR(A,B)"
          ],
          "explain": "AND = NOT ∘ NAND: invert the NAND result.",
          "answerIndex": 1
        }
      ]
    }
  },
  "or": {
    "title": "Build OR",
    "description": "Make an OR chip in the same style as NAND2Tetris.",
    "hints": [
      "Use two data inputs A and B.",
      "OUT is 1 as soon as at least one input is 1."
    ],
    "theory": [
      "OR outputs 1 when AT LEAST one input is 1. Two switches in parallel: if either is closed, current flows.",
      "De Morgan's rule: OR(A,B) = NOT(NAND(NOT(A), NOT(B))). That sounds complicated but isn't: invert both inputs, put them through NAND, invert the result.",
      "Practical use: OR answers 'is anything active?' — think fault detection, interrupts, enable signals."
    ],
    "learning": {
      "goal": "Build OR via De Morgan (NAND + NOT).",
      "concepts": [
        "OR",
        "De Morgan",
        "parallel"
      ],
      "quiz": [
        {
          "question": "When is OR(A,B) = 0?",
          "options": [
            "When A=1",
            "Only when both A and B are 0",
            "When A ≠ B",
            "Never"
          ],
          "explain": "OR is low only when both inputs are low.",
          "answerIndex": 1
        }
      ]
    }
  },
  "xor": {
    "title": "Build XOR",
    "description": "Build XOR as a composite chip.",
    "hints": [
      "Use XOR logic: exactly one input high gives a high output.",
      "Check all four combinations before you save."
    ],
    "theory": [
      "XOR (Exclusive OR) outputs 1 when the inputs DIFFER: one is 0 and the other is 1. When they are equal, XOR always outputs 0.",
      "XOR is the core of binary addition: 0+0=0, 0+1=1, 1+0=1, 1+1=0 (with carry) — the SUM column is exactly XOR.",
      "Classic implementation with four NAND gates: NAND(A,B) gives helper H. Then AND(OR(A,B), H) — or more directly: NAND(NAND(A,H), NAND(B,H))."
    ],
    "learning": {
      "goal": "Build XOR: output 1 exactly when the inputs differ.",
      "concepts": [
        "XOR",
        "addition",
        "difference"
      ],
      "quiz": [
        {
          "question": "XOR(1,1) is…",
          "options": [
            "1",
            "0",
            "undefined",
            "2"
          ],
          "explain": "XOR is 1 only on difference; equal inputs give 0.",
          "answerIndex": 1
        },
        {
          "question": "Which gate forms the SUM bit of a half adder?",
          "options": [
            "AND",
            "OR",
            "XOR",
            "NOR"
          ],
          "explain": "The units column of binary addition is XOR.",
          "answerIndex": 2
        }
      ]
    }
  },
  "xor-nand-only": {
    "title": "Build XOR (NAND only)",
    "description": "Same truth table as XOR, but you may only use built-in NAND gates (no AND/OR/NOT/XOR on the canvas). Sub-chips are allowed as long as they also contain only NAND.",
    "hints": [
      "Your Output pin must be named OUT (as in other challenges).",
      "Save the chip under the name XORNAND.",
      "Only node type NAND is allowed besides Input/Output, wires, Splitter/Joiner, and your own chips."
    ],
    "theory": [
      "This challenge enforces NAND's universal character: every Boolean function can be built with NAND alone.",
      "Splitter and Joiner are not logic gates — you may use them for wide buses if you build XOR on multiple bits.",
      "If you make an intermediate chip, also check it for hidden AND/OR/NOT: the checker looks recursively into saved chips."
    ],
    "learning": {
      "goal": "Prove that XOR also works with exclusively NAND gates.",
      "concepts": [
        "universal gate",
        "gate constraint",
        "NAND-only"
      ],
      "quiz": [
        {
          "question": "What may you not use on this canvas?",
          "options": [
            "Input pins",
            "Built-in AND/OR/NOT/XOR gates",
            "Wires",
            "Your own chips"
          ],
          "explain": "Only built-in NAND is allowed as a gate; custom chips are fine if they are also NAND-only.",
          "answerIndex": 1
        }
      ]
    }
  },
  "mux": {
    "title": "Build MUX",
    "description": "Make a multiplexer with two data lines and one select.",
    "hints": [
      "Use A, B, and SEL as inputs.",
      "When SEL=0, OUT must equal A; when SEL=1, OUT must equal B."
    ],
    "theory": [
      "A MUX (multiplexer) is a programmable data switch: SEL=0 passes A through, SEL=1 passes B through. Like setting a railroad switch.",
      "Formula: OUT = (A AND NOT(SEL)) OR (B AND SEL). You can implement this directly with AND, NOT, and OR.",
      "MUX is extremely powerful: with enough select lines you can implement any logic function using only MUX gates. Processors use MUXes constantly for data routing."
    ],
    "learning": {
      "goal": "Build a 2-way multiplexer: SEL chooses between A and B.",
      "concepts": [
        "MUX",
        "select",
        "data routing"
      ]
    }
  },
  "dmux": {
    "title": "Build DMUX",
    "description": "Split one input to two outputs based on a select line.",
    "hints": [
      "Use IN and SEL as inputs.",
      "When SEL=0, IN goes to A and B stays low.",
      "When SEL=1, IN goes to B and A stays low."
    ],
    "theory": [
      "DMUX (demultiplexer) is the inverse of MUX: one input is steered to one of two outputs. The other output always stays 0.",
      "Formula: A = IN AND NOT(SEL), B = IN AND SEL. Two AND gates are enough.",
      "DMUX is the basis of addressing: use SEL bits to choose which part of the system receives a signal — memory bank, register, I/O port."
    ],
    "learning": {
      "goal": "Build a demultiplexer: send IN to A or B based on SEL.",
      "concepts": [
        "DMUX",
        "addressing",
        "select"
      ]
    }
  },
  "not16": {
    "title": "Build Not16",
    "description": "16-bit inverter: every bit of IN is inverted to OUT.",
    "hints": [
      "Use a NOT gate with width=16, or sixteen 1-bit NOTs with Splitter/Joiner.",
      "MSB is on the left in the bit string."
    ],
    "theory": [
      "Not16 is bitwise NOT: invert each bit independently. No carry between positions — parallel work.",
      "In the ALU you use Not16 to negate operands (nx/ny/no control bits in HACK)."
    ],
    "learning": {
      "goal": "Scale NOT to 16 bits (bitwise invert of an entire bus).",
      "concepts": [
        "Not16",
        "bitwise",
        "16-bit"
      ]
    }
  },
  "and16": {
    "title": "Build And16",
    "description": "16-bit AND: OUT[i] = A[i] AND B[i] for every bit position.",
    "hints": [
      "An AND gate with width=16 is enough, or repeat 1-bit AND per position.",
      "Useful later for masking in the ALU."
    ],
    "theory": [
      "And16 is bitwise AND across an entire bus — ideal for masking or clearing bits.",
      "In the HACK ALU, And16 provides the f=0 branch (AND instead of ADD)."
    ],
    "learning": {
      "goal": "Build And16: bitwise AND over two 16-bit buses.",
      "concepts": [
        "And16",
        "masking",
        "bus"
      ]
    }
  },
  "or16": {
    "title": "Build Or16",
    "description": "16-bit OR: OUT[i] = A[i] OR B[i] for every bit position.",
    "hints": [
      "Same pattern as And16, but with OR.",
      "Width=16 on the builtin OR gate works directly."
    ],
    "theory": [
      "Or16 is bitwise OR: bits are combined per position with no interaction between positions.",
      "Useful for setting flags or enable masks across an entire bus."
    ],
    "learning": {
      "goal": "Build Or16: bitwise OR over two 16-bit buses.",
      "concepts": [
        "Or16",
        "bitwise",
        "bus"
      ]
    }
  },
  "mux16": {
    "title": "Build Mux16",
    "description": "16-bit multiplexer: SEL=0 → OUT=A, SEL=1 → OUT=B (entire bus).",
    "hints": [
      "Reuse your 1-bit MUX sixteen times, or build with And16/Or16/Not16: OUT = (A AND Not16(SEL…)) OR (B AND SEL…).",
      "SEL is 1 bit; you must 'widen' it to 16 bits (all bits equal to SEL) if you use bus-AND."
    ],
    "theory": [
      "Mux16 chooses between two 16-bit buses with one select bit — the backbone of datapaths.",
      "In RAM and ALU you see Mux16 everywhere: choose register value, choose memory word, choose ALU branch."
    ],
    "learning": {
      "goal": "Build Mux16: choose between two 16-bit buses with one select bit.",
      "concepts": [
        "Mux16",
        "datapath",
        "select"
      ]
    }
  },
  "or4way": {
    "title": "Build Or4Way",
    "description": "Output 1 if at least one bit of the 4-bit input is high.",
    "hints": [
      "Use a Splitter (width=4, highWidth=1) to pull bits out of IN one by one.",
      "OR all four bits together with three OR gates in a chain.",
      "Tip: save the standalone OR and AND chips from Challenges first if you still need them."
    ],
    "theory": [
      "Or4Way extends OR to multiple bits: the output is 1 as soon as ONE of the four input bits is high. This is called a 'reduction OR'.",
      "Multi-bit buses: in this project you use a 4-bit wide Input pin. The Splitter node cuts that bus into separate bits (set highWidth=1). That gives bit 3 in HI and bits 2–0 in LO — repeat this pattern.",
      "Or4Way is useful as a zero detector: if Or4Way(x) = 0, then x == 0. Later you use this in the ALU to compute the 'zero' flag."
    ],
    "learning": {
      "goal": "Reduce 4 bits to 1 with OR (zero-detection pattern).",
      "concepts": [
        "reduction OR",
        "splitter",
        "multi-bit"
      ]
    }
  },
  "mux4way": {
    "title": "Build Mux4Way",
    "description": "Choose one of four data inputs based on select lines S0 and S1.",
    "hints": [
      "S0=0,S1=0 → A · S0=1,S1=0 → B · S0=0,S1=1 → C · S0=1,S1=1 → D.",
      "Use two MUX chips: one for {A,B} and one for {C,D}, with S0 as select.",
      "Combine their outputs with a third MUX on S1."
    ],
    "theory": [
      "Mux4Way has two select bits (S0, S1) and can therefore address 4 possible choices (2² = 4). With n select bits you address 2ⁿ inputs.",
      "Build principle: divide and conquer. Two ordinary MUXes handle {A,B} and {C,D} each on S0. A third MUX then chooses the right pair on S1.",
      "Mux4Way forms the basis of Mux8Way and ultimately memory: a RAM chip is essentially a huge tree of MUX gates that turns an address into a specific cell."
    ],
    "learning": {
      "goal": "Choose one of four inputs with two select bits.",
      "concepts": [
        "Mux4Way",
        "select tree",
        "2ⁿ choices"
      ]
    }
  },
  "dmux4way": {
    "title": "Build DMux4Way",
    "description": "Send one input to one of four outputs based on S0 and S1.",
    "hints": [
      "S0=0,S1=0 → A · S0=1,S1=0 → B · S0=0,S1=1 → C · S0=1,S1=1 → D.",
      "First use a DMUX with S1 to split IN into two branches.",
      "Then apply a DMUX with S0 on each branch to split further."
    ],
    "theory": [
      "DMux4Way is the inverse of Mux4Way: one signal is sent to exactly one of four destinations, depending on S0 and S1.",
      "Build principle: a first DMUX on S1 splits IN into two 'branches'. Each branch goes to a second DMUX on S0. Result: a tree structure with 4 leaves.",
      "DMux4Way is the basis for memory addressing: indicate which RAM bank receives a write. Combine DMux4Way with Mux4Way for read+write memory."
    ],
    "learning": {
      "goal": "Send one input to exactly one of four outputs.",
      "concepts": [
        "DMux4Way",
        "decode",
        "address tree"
      ]
    }
  },
  "or8way": {
    "title": "Build Or8Way",
    "description": "Reduction-OR over 8 bits: OUT=1 if at least one bit of IN is high.",
    "hints": [
      "Splitter (width=8) + OR chain, or two Or4Way chips + OR.",
      "OUT=0 only when IN=00000000 — useful as a zero-detection building block."
    ],
    "theory": [
      "Or8Way is the 8-bit variant of Or4Way: one bit that says whether there is a 1 somewhere in the bus.",
      "In the ALU you often build zr as NOT(Or8Way(high) OR Or8Way(low)) on the 16-bit OUT."
    ],
    "learning": {
      "goal": "Build Or8Way: reduction-OR over 8 bits.",
      "concepts": [
        "Or8Way",
        "zero-detect",
        "reduction"
      ]
    }
  },
  "mux4way16": {
    "title": "Build Mux4Way16",
    "description": "Choose one of four 16-bit buses with a 2-bit SEL (00=A … 11=D).",
    "hints": [
      "SEL=00→A, 01→B, 10→C, 11→D (MSB of SEL is on the left).",
      "Two Mux16s on SEL[0], then one Mux16 on SEL[1] — same tree as Mux4Way."
    ],
    "theory": [
      "Mux4Way16 is Mux4Way at bus width 16: two select bits choose between four words.",
      "Essential in RAM: read one of four banks based on the low address bits."
    ],
    "learning": {
      "goal": "Choose one of four 16-bit words with a 2-bit SEL.",
      "concepts": [
        "Mux4Way16",
        "bus-MUX",
        "RAM read"
      ]
    }
  },
  "mux8way16": {
    "title": "Build Mux8Way16",
    "description": "Choose one of eight 16-bit buses with a 3-bit SEL (000=A … 111=H).",
    "hints": [
      "Two Mux4Way16s (A–D and E–H) on SEL[1:0], then Mux16 on SEL[2].",
      "Pin labels exactly A…H and SEL."
    ],
    "theory": [
      "Mux8Way16 addresses eight words with three select bits — the read side of RAM8.",
      "Build hierarchically: reuse Mux4Way16 instead of drawing everything flat."
    ],
    "learning": {
      "goal": "Choose one of eight 16-bit words with a 3-bit SEL.",
      "concepts": [
        "Mux8Way16",
        "RAM8",
        "hierarchy"
      ]
    }
  },
  "dmux8way": {
    "title": "Build DMux8Way",
    "description": "Send 1-bit IN to exactly one of eight outputs (A–H) based on 3-bit SEL.",
    "hints": [
      "First DMux on SEL[2], then per branch a DMux4Way on SEL[1:0].",
      "Only the selected output may follow IN; the rest stay 0."
    ],
    "theory": [
      "DMux8Way is the write side of RAM8: SEL chooses which cell may see LOAD.",
      "Combine with Mux8Way16 for a complete 8-word memory bank."
    ],
    "learning": {
      "goal": "Decode 3-bit SEL into eight 1-bit write lines.",
      "concepts": [
        "DMux8Way",
        "RAM write",
        "decode"
      ]
    }
  },
  "half-adder": {
    "title": "Build Half Adder",
    "description": "Build SUM and CARRY as separate outputs.",
    "hints": [
      "SUM works as XOR of A and B.",
      "CARRY works as AND of A and B."
    ],
    "theory": [
      "Binary addition: 0+0=0, 0+1=1, 1+0=1, but 1+1=10 (two bits: sum=0, carry=1). The Half Adder computes both bits separately.",
      "SUM is the 'units column': XOR(A,B). CARRY is the 'carry to the next column': AND(A,B).",
      "Why 'half'? Because it has no carry-IN. You can only use it for the least significant bit (right). For all other bits you need the Full Adder."
    ],
    "learning": {
      "goal": "Build SUM (XOR) and CARRY (AND) for 1-bit addition without carry-in.",
      "concepts": [
        "half adder",
        "SUM",
        "carry"
      ]
    }
  },
  "full-adder": {
    "title": "Build Full Adder",
    "description": "Combine adders into a complete 1-bit adder with carry-in and carry-out.",
    "hints": [
      "Use two half adders or an equivalent of your own.",
      "COUT is high as soon as at least two inputs are high."
    ],
    "theory": [
      "The Full Adder adds three bits: A, B, and a carry-in (CIN) from the previous bit position. This makes chains of adders possible.",
      "Implementation with two Half Adders: Step 1: Half Adder on A and B → gives SUM1 and CARRY1. Step 2: Half Adder on SUM1 and CIN → gives SUM and CARRY2. COUT = CARRY1 OR CARRY2.",
      "This is the core of every processor: by chaining Full Adders (ripple-carry) you build an adder for any desired bit width. Add4 and Add16 are simply four or sixteen Full Adders in series."
    ],
    "learning": {
      "goal": "Extend the half adder with carry-in into a complete 1-bit adder.",
      "concepts": [
        "full adder",
        "CIN",
        "COUT"
      ]
    }
  },
  "add4": {
    "title": "Build Add4",
    "description": "Adder for two 4-bit numbers. Overflow is ignored (no carry-out).",
    "hints": [
      "First save your Half Adder and Full Adder chips if you still need them.",
      "Use Splitters (width=4, highWidth=1) to split A and B bit by bit.",
      "Bit 3 (MSB left): start with a Half Adder (no carry-in).",
      "Bits 2, 1, 0: Full Adder with carry-in from the previous step.",
      "Use a Joiner to merge the four SUM bits back into OUT[4]."
    ],
    "theory": [
      "Add4 chains four adders: this is called a ripple-carry adder. The carry 'ripples' from right (LSB) to left (MSB), just like adding by hand.",
      "Bit order in this system: the most significant bit (MSB) is on the left. 'A = 0110' means 6 in decimal (0·8 + 1·4 + 1·2 + 0·1). Use the Inspector to set a pin's width.",
      "Overflow: 4 bits can only hold values 0 to 15. If the sum is 16 or higher, it wraps: 15+1 = 0 (the MSB carry-out is ignored). In real computers this carry is kept in a status register.",
      "For Add16 (original nand2tetris) you do exactly the same but with 16 bits. The principle is identical."
    ],
    "learning": {
      "goal": "Chain full adders into a 4-bit adder.",
      "concepts": [
        "ripple carry",
        "Add4",
        "bus"
      ]
    }
  },
  "inc4": {
    "title": "Build Inc4",
    "description": "Increment a 4-bit number by 1. Overflow wraps back to 0.",
    "hints": [
      "Easiest route: use your Add4 chip with A=IN and B=a Switch (width=4, value=0001).",
      "Direct build: the LSB (bit 0, right) always toggles. Use a NOT gate.",
      "Bit 1 flips only if bit 0 was '1' (carry). Bit 2 flips only if bits 0 and 1 were both '1'."
    ],
    "theory": [
      "Incrementing is a special case of addition: +1. In binary this means you can follow the carry chain from right to left.",
      "Pattern: the LSB (bit 0) always toggles on +1. Bit 1 toggles only if bit 0 produced a carry (bit 0 was 1). Bit 2 toggles if bits 0 and 1 were both 1. And so on.",
      "Inc4 is crucial in processors: the program counter (PC) increments by 1 every clock cycle to point to the next instruction."
    ],
    "learning": {
      "goal": "Build a 4-bit incrementer (X + 1).",
      "concepts": [
        "Inc4",
        "increment",
        "adder"
      ]
    }
  },
  "dff": {
    "title": "Build Bit (DFF + LOAD)",
    "description": "1-bit memory cell with load: only when LOAD=1 and a CLK tick does OUT take the value of IN; otherwise it keeps the old value.",
    "hints": [
      "In this app the builtin Register node is the DFF primitive: on CLK=1 it copies D→Q.",
      "Two build routes: (1) MUX before D (LOAD ? IN : OUT), or (2) simpler — D=IN and gate the clock: CLK_reg = CLK AND LOAD.",
      "Tip: route (2) avoids a combinational loop back to Q; just connect OUT to Q."
    ],
    "theory": [
      "A D flip-flop (DFF) is the smallest memory circuit: it stores one bit until the next clock pulse. Combinational gates have no memory; without DFF there are no registers, no RAM, no CPU.",
      "In Forge Logic the built-in Register node is exactly that DFF primitive: while CLK=1 (during a tick) D is copied to Q; when CLK=0, Q stays unchanged. RST on the node has priority, but you do not use it in this lesson.",
      "The Nand2Tetris Bit wraps LOAD around it: if LOAD=0 the DFF must hold itself (D←Q); if LOAD=1, IN may enter (D←IN). That is one MUX before the DFF.",
      "Then you scale up: sixteen Bits → Register16; eight Registers + addressing → RAM8."
    ],
    "learning": {
      "goal": "Understand the DFF primitive and build Bit with LOAD behavior.",
      "concepts": [
        "DFF",
        "Bit",
        "LOAD",
        "state"
      ]
    }
  },
  "register-chip": {
    "title": "Build Register (Bit)",
    "description": "1-bit register: takes the value of D on CLK=1, and resets on RST=1.",
    "hints": [
      "Use D, CLK, and RST as inputs and Q as output.",
      "After a step with CLK=1, Q must take the value of D.",
      "On RST=1, Q must return to 0 (RST has higher priority).",
      "Use a Register node as memory. Connect D and CLK directly."
    ],
    "theory": [
      "After the Bit lesson (DFF + LOAD) you practice the bare Register/DFF interface with explicit RST here: D, CLK, RST → Q.",
      "Behavior: on CLK=1 (during a tick) the register copies D into its internal storage. When CLK=0 nothing changes.",
      "RST has higher priority than CLK: if RST=1 the stored value is set to 0 regardless of CLK.",
      "Use the built-in Register node. 'Step Registers' in the toolbar simulates one tick."
    ],
    "learning": {
      "goal": "Expose the bare DFF/Register interface with D, CLK, and RST.",
      "concepts": [
        "register",
        "RST",
        "CLK"
      ]
    }
  },
  "register16": {
    "title": "Build Register16",
    "description": "16-bit register with LOAD: when LOAD=1 and a CLK tick, IN is taken; otherwise OUT stays the same.",
    "hints": [
      "Use a Register node with width=16, or sixteen Bit chips.",
      "LOAD MUX at bus level: Mux16(OUT, IN, LOAD) → D of the register.",
      "Same tick semantics as Bit: only LOAD=1 and CLK=1 writes."
    ],
    "theory": [
      "Register16 is Bit × 16: one LOAD and one CLK drive all bits at once.",
      "In the HACK CPU, the A and D registers are exactly such 16-bit registers with load control bits from the instruction.",
      "You now have the bridge DFF → Bit → Register16; next comes the PC and eventually RAM."
    ],
    "learning": {
      "goal": "Scale Bit up to a 16-bit register with shared LOAD.",
      "concepts": [
        "Register16",
        "LOAD",
        "16-bit state"
      ]
    }
  },
  "pc": {
    "title": "Build PC",
    "description": "Program counter: RST resets to 0, LOAD loads IN, INC increments. Priority: RST > LOAD > INC.",
    "hints": [
      "Use a Register node as memory for the current value (OUT = Q of the register).",
      "Compute the 'next value' combinationally: NOT(OUT) when INC, IN when LOAD, 0 when RST.",
      "Use MUX chips to handle priority: start with (INC ? NOT(OUT) : OUT), then (LOAD ? IN : previous), then (RST ? 0 : previous).",
      "Connect the final result to D of the Register node and use CLK to step."
    ],
    "theory": [
      "The program counter (PC) is a special register that tracks which instruction the processor executes next. Each clock cycle it normally increments by 1 (INC).",
      "Three special situations interrupt counting: RST (reset to 0, e.g. at startup), LOAD (jump to a specific address, e.g. on a jump instruction), and simply waiting (no INC, OUT stays).",
      "Priority order RST > LOAD > INC is essential: a reset must always win. Implement this as nested MUXes from low to high priority.",
      "The PC illustrates how combinational logic (compute the 'next value') and sequential logic (the Register node) work together: the combinational layer decides WHAT is stored, the register decides WHEN."
    ],
    "learning": {
      "goal": "Build a program counter that can reset, load, and increment.",
      "concepts": [
        "PC",
        "increment",
        "control"
      ]
    }
  },
  "add16": {
    "title": "Build Add16",
    "description": "Ripple-carry addition for two 16-bit numbers (overflow/carry-out is ignored, like Add4).",
    "hints": [
      "Copy the Add4 pattern: Full Adders in a chain, Splitters/Joiners for buses.",
      "MSB is on the left in the bit string."
    ],
    "theory": [
      "Add16 has the same structure as Add4: sixteen Full Adders (or sixteen of your own 1-bit adder) with carry between positions.",
      "This is the core of the ALU: once you have Add16, you can add in one clock cycle (plus optional carry-lookahead in real CPUs)."
    ],
    "learning": {
      "goal": "Scale addition to 16 bits with the same adder ideas.",
      "concepts": [
        "Add16",
        "16-bit",
        "bus"
      ]
    }
  },
  "inc16": {
    "title": "Build Inc16",
    "description": "Increment a 16-bit value by 1; overflow wraps to 0.",
    "hints": [
      "Reuse Add16 with B=0000000000000001 or build a carry chain.",
      "Explicitly test IN=1111111111111111 → OUT=0."
    ],
    "theory": [
      "Inc16 is how a program counter (PC) steps forward: each instruction is +1 on the current address.",
      "In a real CPU, Inc16 is often merged with branch logic; here you practice pure increment."
    ],
    "learning": {
      "goal": "Build Inc16: increment a 16-bit value by 1.",
      "concepts": [
        "Inc16",
        "PC helper",
        "16-bit"
      ]
    }
  },
  "alu": {
    "title": "Build ALU (16-bit)",
    "description": "nand2tetris-style ALU: control X and Y with zx,nx,zy,ny,f,no; read OUT (16), zr (1 if OUT==0), ng (1 if MSB of OUT is set).",
    "hints": [
      "First build helpers: zero/negate on X and Y, then MUX between AND and ADD, then optional NOT on the result.",
      "zr = reduction-NOR of all OUT bits; ng = most significant bit of OUT.",
      "Pin labels exactly: X, Y, ZX, NX, ZY, NY, F, NO, OUT, ZR, NG."
    ],
    "theory": [
      "The HACK ALU is the heart of the CPU from the book: one circuit for AND, ADD, invert, compare, and constants.",
      "The flags zr and ng are exactly what you need for conditional jumps (jump if zero / jump if negative).",
      "The reference implementation for the tests is in src/sim/hack-alu.js — ideal for checking your own results while building."
    ],
    "learning": {
      "goal": "Implement the HACK ALU with control bits zx/nx/zy/ny/f/no.",
      "concepts": [
        "ALU",
        "zr",
        "ng",
        "HACK"
      ]
    }
  },
  "instruction-decoder": {
    "title": "Build Instruction Decoder",
    "description": "Split a 16-bit HACK instruction into control bits: isA (1 if MSB=0), comp (7), dest (3), jump (3).",
    "hints": [
      "A-instruction: MSB=0 → isA=1. C-instruction: MSB=1 → isA=0.",
      "C format: 111 a cccccc ddd jjj — comp = a+cccccc (bits 12–6), dest = bits 5–3, jump = bits 2–0.",
      "Use Splitter chains or bit selection; the fields are pure slices of IN."
    ],
    "theory": [
      "Every HACK instruction is 16 bits. Bit 15 distinguishes A-instructions (0vvvvvvvvvvvvvvv) from C-instructions (111accccccdddjjj).",
      "The decoder is combinational: it only slices fields — no memory. Later the CPU uses these bits to drive the ALU, registers, and PC.",
      "comp (7 bits) feeds the ALU control bits; dest decides whether A/D/M load; jump combines with zr/ng for branches."
    ],
    "learning": {
      "goal": "Split HACK instructions into isA, comp, dest, and jump.",
      "concepts": [
        "A/C instruction",
        "comp",
        "dest",
        "jump"
      ]
    }
  },
  "alu-with-registers": {
    "title": "Build ALU + Registers",
    "description": "Mini datapath: A and D registers + ALU. ALU Y is A; X is D. Load A with A_IN, load D from ALU out.",
    "hints": [
      "Register16 (or wide register) for A and D; gate CLK with A_LOAD / D_LOAD.",
      "ALU: X=D, Y=A, control bits ZX…NO; ALUOUT/ZR/NG combinational.",
      "D loads ALUOUT when D_LOAD=1; A loads A_IN when A_LOAD=1."
    ],
    "theory": [
      "This is the core of the HACK datapath: A and D feed the ALU; the ALU result can go back to D (or later to A/M).",
      "The control bits ZX…NO later come from the instruction decoder (comp field). Here you still set them by hand.",
      "Expected ALU outcomes in the tests come from computeHackAlu — the same reference as the ALU lesson."
    ],
    "learning": {
      "goal": "Connect A/D registers to the ALU into a mini datapath.",
      "concepts": [
        "datapath",
        "A-register",
        "D-register"
      ]
    }
  },
  "ram8": {
    "title": "Build RAM8",
    "description": "8 words × 16 bits: when LOAD=1 and a CLK tick you write IN to memory[ADDR]; OUT always shows memory[ADDR] (combinational read). ADDR is 3-bit.",
    "hints": [
      "Use eight 16-bit registers (or your own wide register chip) and DMux8Way/Mux8Way-style address decoding.",
      "Connect the external CLK input to the Register CLK inputs; Submit uses ticks with your CLK pin.",
      "Make sure OUT combinationally follows the selected cell."
    ],
    "theory": [
      "RAM8 is the first real memory bank: an address chooses which word you read or write.",
      "You already have the building blocks: DFF→Bit (LOAD), Register16, and Mux8Way16/DMux8Way for addressing.",
      "In hardware simulators 'load' is synchronous with the clock: only after a tick with LOAD=1 does the cell change.",
      "Build eight Register16s (or Bit rows), decode ADDR with DMux8Way into eight load lines, and select the read bus with Mux8Way16."
    ],
    "learning": {
      "goal": "Build 8 words × 16-bit memory with address decoding.",
      "concepts": [
        "RAM8",
        "ADDR",
        "LOAD"
      ]
    }
  },
  "mod4-counter": {
    "title": "Build Mod4 Counter",
    "description": "Sequential building block: 2-bit counter. RST=1 resets to 00; each tick with CLK=1 (after stable inputs) counts +1 mod 4.",
    "hints": [
      "A 2-bit register or a chain of toggles + AND for carry.",
      "Account for the Submit sequence: first RST pulses, then individual CLK ticks to count."
    ],
    "theory": [
      "A mod-4 counter is a miniature program counter: it shows how state and clock work together 'step by step'.",
      "This is a light CPU-like exercise: later you combine such a counter with ROM and ALU into a simple datapath."
    ],
    "learning": {
      "goal": "Build a 2-bit counter that counts modulo 4 on the clock.",
      "concepts": [
        "counter",
        "mod 4",
        "sequential"
      ]
    }
  },
  "ram64": {
    "title": "Build RAM64",
    "description": "Build RAM64: 64 words × 16 bits. LOAD=1 + CLK tick writes IN to memory[ADDR]; OUT reads combinationally.",
    "hints": [
      "Stack RAM8/RAM64 chips or registers with address decoding (Mux/DMux).",
      "OUT must combinationally show the selected cell.",
      "ADDR is 6-bit (64 words)."
    ],
    "theory": [
      "Build RAM64 is a larger memory bank — the same LOAD/ADDR/CLK interface as RAM8, but more address bits.",
      "Build hierarchically: each doubling of memory is often 'eight times the smaller RAM + an extra address bit'."
    ],
    "learning": {
      "goal": "Scale RAM8 hierarchically up to 64 words.",
      "concepts": [
        "RAM64",
        "hierarchy",
        "address bits"
      ]
    }
  },
  "ram512": {
    "title": "Build RAM512",
    "description": "Build RAM512: 512 words × 16 bits. LOAD=1 + CLK tick writes IN to memory[ADDR]; OUT reads combinationally.",
    "hints": [
      "Stack RAM8/RAM64 chips or registers with address decoding (Mux/DMux).",
      "OUT must combinationally show the selected cell.",
      "ADDR is 9-bit (512 words)."
    ],
    "theory": [
      "Build RAM512 is a larger memory bank — the same LOAD/ADDR/CLK interface as RAM8, but more address bits.",
      "Build hierarchically: each doubling of memory is often 'eight times the smaller RAM + an extra address bit'."
    ],
    "learning": {
      "goal": "Build RAM512 as a stack of smaller RAM blocks.",
      "concepts": [
        "RAM512",
        "memory bank"
      ]
    }
  },
  "ram4k": {
    "title": "Build RAM4K",
    "description": "Build RAM4K: 4096 words × 16 bits. LOAD=1 + CLK tick writes IN to memory[ADDR]; OUT reads combinationally.",
    "hints": [
      "Stack RAM8/RAM64 chips or registers with address decoding (Mux/DMux).",
      "OUT must combinationally show the selected cell.",
      "ADDR is 12-bit (4096 words)."
    ],
    "theory": [
      "Build RAM4K is a larger memory bank — the same LOAD/ADDR/CLK interface as RAM8, but more address bits.",
      "Build hierarchically: each doubling of memory is often 'eight times the smaller RAM + an extra address bit'."
    ],
    "learning": {
      "goal": "Build RAM4K with 12 address bits.",
      "concepts": [
        "RAM4K",
        "12-bit address"
      ]
    }
  },
  "ram16k": {
    "title": "Build RAM16K",
    "description": "Build RAM16K: 16384 words × 16 bits. LOAD=1 + CLK tick writes IN to memory[ADDR]; OUT reads combinationally.",
    "hints": [
      "Stack RAM8/RAM64 chips or registers with address decoding (Mux/DMux).",
      "OUT must combinationally show the selected cell.",
      "ADDR is 14-bit (16384 words)."
    ],
    "theory": [
      "Build RAM16K is a larger memory bank — the same LOAD/ADDR/CLK interface as RAM8, but more address bits.",
      "Build hierarchically: each doubling of memory is often 'eight times the smaller RAM + an extra address bit'."
    ],
    "learning": {
      "goal": "Build RAM16K — the data memory of the HACK machine.",
      "concepts": [
        "RAM16K",
        "data memory"
      ]
    }
  },
  "cpu": {
    "title": "Build CPU",
    "description": "HACK CPU: inM + instruction + reset → outM, writeM, addressM (15-bit), pc (16-bit). Reset sets pc to 0; then pc increments each cycle.",
    "hints": [
      "Combine PC, A/D registers, ALU, and memory logic as in the book (datapath + control).",
      "Pin labels exactly: inM, instruction, reset, outM, writeM, addressM, pc.",
      "On reset=1, pc must go to 0; on reset=0 and an @0 instruction, pc increments."
    ],
    "theory": [
      "The CPU connects all Project 4/5 chips: PC counts instructions, registers hold state, ALU computes, memory reads/writes.",
      "C-instructions (D=A, D=D+A, 0;JMP) require a real datapath — only pc++ is not enough to pass these tests.",
      "This is the culmination of Nand2Tetris — a working processor built from your own gates and chips."
    ],
    "learning": {
      "goal": "Combine PC, registers, ALU, and memory control into a CPU.",
      "concepts": [
        "CPU",
        "datapath",
        "instruction"
      ]
    }
  },
  "computer": {
    "title": "Build your computer",
    "description": "Final project: connect your CPU (and optionally RAM) to the prefilled ROM + Screen. On play the demo program should set pixels. Pins: reset, CLK → pc.",
    "hints": [
      "ROM.OUT → CPU.instruction; CPU.pc (low bits) → ROM.ADDR.",
      "Simplified I/O: CPU.outM → Screen.IN, writeM → WRITE, addressM[2:0] → ROW, CLK → Screen.CLK.",
      "Snapshot as chip name Computer; verification checks screen rows after clock ticks."
    ],
    "theory": [
      "This is the Nand2Tetris endpoint: instructions from ROM, a CPU that executes them, and visible output on Screen.",
      "In Forge Logic the Screen is 8×8 and you write per row with WRITE+CLK — enough to see 'the computer works'.",
      "The demo program is already in the ROM node; you provide the datapath (CPU + wiring)."
    ],
    "learning": {
      "goal": "Connect ROM, CPU, and Screen into a running mini-computer.",
      "concepts": [
        "computer",
        "ROM",
        "Screen",
        "clock"
      ]
    }
  }
};
