import { clampWidth, clampSplitWidth, normalizeBitString } from "../sim/bits.js";
import { clamp } from "../lib/utils.js";

const ROM_MAX_ADDRESS_WIDTH = 8;

export function normalizeRomProgram(program) {
  if (!Array.isArray(program)) {
    return [];
  }
  return program.map((line) => normalizeBitString(String(line ?? ""), 16));
}

export function clampRomAddressWidth(value) {
  const numeric = Number(value);
  const base = Number.isFinite(numeric) ? numeric : 4;
  return Math.round(clamp(base, 1, ROM_MAX_ADDRESS_WIDTH));
}

export function normalizeNode(node) {
  const normalized = {
    id: node.id,
    type: node.type,
    x: Number(node.x) || 100,
    y: Number(node.y) || 100,
    config: { ...(node.config || {}) },
  };

  if (normalized.type === "switch") {
    normalized.config.label = normalized.config.label || "Switch";
    normalized.config.width = clampWidth(normalized.config.width);
    normalized.config.value = normalizeBitString(normalized.config.value, normalized.config.width);
  } else if (normalized.type === "lamp") {
    normalized.config.label = normalized.config.label || "Lamp";
    normalized.config.width = clampWidth(normalized.config.width);
  } else if (normalized.type === "gate") {
    normalized.config.label = normalized.config.label || "Gate";
    normalized.config.gateType = String(normalized.config.gateType || "AND").toUpperCase();
    normalized.config.width = clampWidth(normalized.config.width);
  } else if (normalized.type === "input-pin") {
    normalized.config.label = normalized.config.label || "Input";
    normalized.config.width = clampWidth(normalized.config.width);
    normalized.config.previewValue = normalizeBitString(
      normalized.config.previewValue,
      normalized.config.width
    );
  } else if (normalized.type === "output-pin") {
    normalized.config.label = normalized.config.label || "Output";
    normalized.config.width = clampWidth(normalized.config.width);
  } else if (normalized.type === "clock") {
    normalized.config.label = normalized.config.label || "Clock";
    normalized.config.value = normalizeBitString(normalized.config.value, 1);
  } else if (normalized.type === "register") {
    normalized.config.label = normalized.config.label || "Register";
    normalized.config.width = clampWidth(normalized.config.width);
    normalized.config.resetValue = normalizeBitString(
      normalized.config.resetValue,
      normalized.config.width
    );
  } else if (normalized.type === "rom") {
    normalized.config.label = normalized.config.label || "ROM";
    normalized.config.addressWidth = clampRomAddressWidth(normalized.config.addressWidth);
    normalized.config.program = normalizeRomProgram(normalized.config.program);
  } else if (normalized.type === "screen") {
    normalized.config.label = normalized.config.label || "Screen";
    normalized.config.cols = 8;
    normalized.config.rows = 8;
  } else if (normalized.type === "keyboard") {
    normalized.config.label = normalized.config.label || "Keyboard";
    normalized.config.keyCode = normalizeBitString(normalized.config.keyCode, 16);
  } else if (normalized.type === "splitter" || normalized.type === "joiner") {
    normalized.config.label = normalized.config.label || (normalized.type === "splitter" ? "Split" : "Join");
    normalized.config.width = Math.max(2, clampWidth(normalized.config.width));
    normalized.config.highWidth = clampSplitWidth(normalized.config.highWidth, normalized.config.width);
  } else if (normalized.type === "chip-instance") {
    normalized.config.label = normalized.config.label || "Chip";
    normalized.config.definitionId = normalized.config.definitionId || "";
  }

  return normalized;
}

export function createNodeFactory(deps) {
  const { allocateId } = deps;

  function createNode(project, type, position) {
    const baseX = position && typeof position.x === "number" ? position.x : 140;
    const baseY = position && typeof position.y === "number" ? position.y : 120;
    const node = {
      id: allocateId(project, "node"),
      type,
      x: baseX,
      y: baseY,
      config: {},
    };

    switch (type) {
      case "switch":
        node.config = { label: "Switch", width: 1, value: "0" };
        break;
      case "lamp":
        node.config = { label: "Lamp", width: 1 };
        break;
      case "input-pin":
        node.config = { label: "Input", width: 1, previewValue: "0" };
        break;
      case "output-pin":
        node.config = { label: "Output", width: 1 };
        break;
      case "clock":
        node.config = { label: "Clock", value: "0" };
        break;
      case "register":
        node.config = { label: "Register", width: 1, resetValue: "0" };
        break;
      case "rom":
        node.config = {
          label: "ROM",
          addressWidth: 4,
          program: ["0000000000000000", "0000000000000001", "0000000000000010"],
        };
        break;
      case "screen":
        node.config = { label: "Screen", cols: 8, rows: 8 };
        break;
      case "keyboard":
        node.config = { label: "Keyboard", keyCode: "0000000000000000" };
        break;
      case "splitter":
        node.config = { label: "Split", width: 4, highWidth: 2 };
        break;
      case "joiner":
        node.config = { label: "Join", width: 4, highWidth: 2 };
        break;
      default:
        if (type.startsWith("gate-")) {
          node.type = "gate";
          node.config = {
            label: type.replace("gate-", "").toUpperCase(),
            gateType: type.replace("gate-", "").toUpperCase(),
            width: 1,
          };
        }
        break;
    }

    return normalizeNode(node);
  }

  return { createNode };
}
