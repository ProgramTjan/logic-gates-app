import en from "./en.js";
import nl from "./nl.js";

export const LOCALE_STORAGE_KEY = "forge-logic-locale";
export const SUPPORTED_LOCALES = ["en", "nl"];
export const DEFAULT_LOCALE = "en";

const DICTS = { en, nl };

let currentLocale = DEFAULT_LOCALE;

function normalizeLocale(code) {
  const value = String(code || "").toLowerCase();
  return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

function interpolate(template, vars) {
  if (!vars || typeof template !== "string") {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : `{${key}}`
  );
}

export function getLocale() {
  return currentLocale;
}

export function readStoredLocale(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!storage) {
    return DEFAULT_LOCALE;
  }
  try {
    return normalizeLocale(storage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function setLocale(code, options = {}) {
  const { storage = typeof localStorage !== "undefined" ? localStorage : null, persist = true } =
    options;
  currentLocale = normalizeLocale(code);
  if (persist && storage) {
    try {
      storage.setItem(LOCALE_STORAGE_KEY, currentLocale);
    } catch {
      /* ignore quota */
    }
  }
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = currentLocale;
  }
  return currentLocale;
}

export function initLocale(options = {}) {
  return setLocale(readStoredLocale(options.storage), options);
}

export function t(key, vars) {
  const dict = DICTS[currentLocale] || DICTS.en;
  const fallback = DICTS.en;
  const template =
    (dict && dict[key] !== undefined ? dict[key] : undefined) ??
    (fallback && fallback[key] !== undefined ? fallback[key] : undefined) ??
    key;
  return interpolate(template, vars);
}

/** Apply data-i18n / data-i18n-html / data-i18n-title / data-i18n-aria / data-i18n-placeholder */
export function applyStaticI18n(root = typeof document !== "undefined" ? document : null) {
  if (!root) {
    return;
  }
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      el.textContent = t(key);
    }
  });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (key) {
      el.innerHTML = t(key);
    }
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (key) {
      el.setAttribute("title", t(key));
    }
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (key) {
      el.setAttribute("aria-label", t(key));
    }
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) {
      el.setAttribute("placeholder", t(key));
    }
  });
  const meta = root.querySelector?.('meta[name="description"]') || document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute("content", t("metaDescription"));
  }
  document.querySelectorAll("[data-set-locale]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-set-locale") === currentLocale);
  });
}

/** Proxy so existing `S.key` call sites stay in sync with locale. */
export const S = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== "string") {
        return undefined;
      }
      return t(prop);
    },
  }
);
