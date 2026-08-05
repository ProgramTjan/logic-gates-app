const MARK_GZIP = "p=v1.";
const MARK_RAW = "p=u1.";

function uint8ToBase64Url(u8) {
  let binary = "";
  for (let i = 0; i < u8.length; i += 1) {
    binary += String.fromCharCode(u8[i]);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUint8(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export async function encodeProjectForUrlHash(project) {
  const json = JSON.stringify(project);
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream !== "undefined") {
    const stream = new CompressionStream("gzip");
    const writer = stream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buffer = await new Response(stream.readable).arrayBuffer();
    return `${MARK_GZIP}${uint8ToBase64Url(new Uint8Array(buffer))}`;
  }
  return `${MARK_RAW}${uint8ToBase64Url(bytes)}`;
}

export async function decodeProjectFromUrlHashPayload(payload) {
  if (payload.startsWith(MARK_GZIP)) {
    const raw = base64UrlToUint8(payload.slice(MARK_GZIP.length));
    if (typeof DecompressionStream === "undefined") {
      throw new Error("Gedeelde link gebruikt compressie; je browser ondersteunt geen DecompressionStream.");
    }
    const stream = new DecompressionStream("gzip");
    const writer = stream.writable.getWriter();
    writer.write(raw);
    writer.close();
    const text = await new Response(stream.readable).text();
    return JSON.parse(text);
  }
  if (payload.startsWith(MARK_RAW)) {
    const raw = base64UrlToUint8(payload.slice(MARK_RAW.length));
    const text = new TextDecoder().decode(raw);
    return JSON.parse(text);
  }
  throw new Error("Onbekend linkformaat.");
}

export function parseSharePayloadFromHash(hash) {
  const trimmed = String(hash || "").replace(/^#/, "");
  if (!trimmed.startsWith("p=")) {
    return null;
  }
  return trimmed;
}
