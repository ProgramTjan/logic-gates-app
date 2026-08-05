import { clampWidth } from "../sim/bits.js";

export function createNodeSpecFactory(deps) {
  const { getChipDefinition } = deps;

  function getNodeSpec(node) {
    if (!node) {
      return { title: "Missing", subtitle: "", inputs: [], outputs: [] };
    }
    if (node.type === "switch") {
      return {
        title: node.config.label,
        subtitle: `Switch • ${node.config.width}-bit`,
        inputs: [],
        outputs: [{ key: "OUT", name: "OUT", width: node.config.width }],
      };
    }
    if (node.type === "lamp") {
      return {
        title: node.config.label,
        subtitle: `Lamp • ${node.config.width}-bit`,
        inputs: [{ key: "IN", name: "IN", width: node.config.width }],
        outputs: [],
      };
    }
    if (node.type === "gate") {
      const isUnary = node.config.gateType === "NOT";
      return {
        title: node.config.label,
        subtitle: `${node.config.gateType} Gate • ${node.config.width}-bit`,
        inputs: isUnary
          ? [{ key: "A", name: "A", width: node.config.width }]
          : [
              { key: "A", name: "A", width: node.config.width },
              { key: "B", name: "B", width: node.config.width },
            ],
        outputs: [{ key: "OUT", name: "OUT", width: node.config.width }],
      };
    }
    if (node.type === "input-pin") {
      return {
        title: node.config.label,
        subtitle: `Chip Input • ${node.config.width}-bit`,
        inputs: [],
        outputs: [{ key: "OUT", name: "OUT", width: node.config.width }],
      };
    }
    if (node.type === "output-pin") {
      return {
        title: node.config.label,
        subtitle: `Chip Output • ${node.config.width}-bit`,
        inputs: [{ key: "IN", name: "IN", width: node.config.width }],
        outputs: [],
      };
    }
    if (node.type === "clock") {
      return {
        title: node.config.label,
        subtitle: "Clock • 1-bit",
        inputs: [],
        outputs: [{ key: "OUT", name: "OUT", width: 1 }],
      };
    }
    if (node.type === "register") {
      return {
        title: node.config.label,
        subtitle: `Register • ${node.config.width}-bit`,
        inputs: [
          { key: "D", name: "D", width: node.config.width },
          { key: "CLK", name: "CLK", width: 1 },
          { key: "RST", name: "RST", width: 1 },
        ],
        outputs: [{ key: "Q", name: "Q", width: node.config.width }],
      };
    }
    if (node.type === "rom") {
      const addressWidth = Math.max(1, Math.min(8, Number(node.config.addressWidth) || 4));
      const lines = Array.isArray(node.config.program) ? node.config.program.length : 0;
      return {
        title: node.config.label,
        subtitle: `ROM • ADDR ${addressWidth}-bit → OUT 16-bit • ${lines} instr`,
        inputs: [{ key: "ADDR", name: "ADDR", width: addressWidth }],
        outputs: [{ key: "OUT", name: "OUT", width: 16 }],
      };
    }
    if (node.type === "screen") {
      return {
        title: node.config.label,
        subtitle: "Screen • IN[7:0]→rij, ROW(3), WRITE+CLK latched",
        inputs: [
          { key: "IN", name: "IN", width: 16 },
          { key: "ROW", name: "ROW", width: 3 },
          { key: "WRITE", name: "WRITE", width: 1 },
          { key: "CLK", name: "CLK", width: 1 },
        ],
        outputs: [],
      };
    }
    if (node.type === "keyboard") {
      return {
        title: node.config.label,
        subtitle: "Keyboard • OUT=laatste toets (klik=luister, Esc=stop)",
        inputs: [],
        outputs: [{ key: "OUT", name: "OUT", width: 16 }],
      };
    }
    if (node.type === "splitter") {
      const lowWidth = node.config.width - node.config.highWidth;
      return {
        title: node.config.label,
        subtitle: `Bus Split • ${node.config.width}-bit`,
        inputs: [{ key: "IN", name: "IN", width: node.config.width }],
        outputs: [
          { key: "HI", name: `HI(${node.config.highWidth})`, width: node.config.highWidth },
          { key: "LO", name: `LO(${lowWidth})`, width: lowWidth },
        ],
      };
    }
    if (node.type === "joiner") {
      const lowWidth = node.config.width - node.config.highWidth;
      return {
        title: node.config.label,
        subtitle: `Bus Join • ${node.config.width}-bit`,
        inputs: [
          { key: "HI", name: `HI(${node.config.highWidth})`, width: node.config.highWidth },
          { key: "LO", name: `LO(${lowWidth})`, width: lowWidth },
        ],
        outputs: [{ key: "OUT", name: "OUT", width: node.config.width }],
      };
    }
    if (node.type === "chip-instance") {
      const definition = getChipDefinition(node.config.definitionId);
      if (!definition) {
        return {
          title: node.config.label || "Missing Chip",
          subtitle: "Chip ontbreekt",
          inputs: [],
          outputs: [],
        };
      }
      return {
        title: node.config.label || definition.name,
        subtitle: `${definition.name} v${definition.version}`,
        inputs: definition.inputs.map((pin) => ({
          key: pin.key,
          name: pin.name,
          width: clampWidth(pin.width),
        })),
        outputs: definition.outputs.map((pin) => ({
          key: pin.key,
          name: pin.name,
          width: clampWidth(pin.width),
        })),
      };
    }
    return { title: "Unknown", subtitle: "", inputs: [], outputs: [] };
  }

  return { getNodeSpec };
}
