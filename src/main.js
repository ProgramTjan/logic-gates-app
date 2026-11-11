import "../script.js";

if (window.ForgeLogicApp && typeof window.ForgeLogicApp.start === "function") {
  window.ForgeLogicApp.start();
}

registerServiceWorker();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const isLocalhost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "[::1]";
  if (location.protocol !== "https:" && !isLocalhost) {
    return;
  }

  const start = () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .then((registration) => {
        if (registration.waiting) {
          notifyUpdateAvailable();
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdateAvailable();
            }
          });
        });
      })
      .catch((error) => {
        console.warn("Service worker registratie mislukt:", error);
      });
  };

  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
}

function notifyUpdateAvailable() {
  const statusLine = document.getElementById("status-line");
  if (statusLine) {
    import("./i18n/index.js")
      .then(({ t }) => {
        statusLine.textContent = t("status.updateAvailable");
        statusLine.classList.add("is-visible");
      })
      .catch(() => {
        statusLine.textContent = "New version available — refresh the page.";
        statusLine.classList.add("is-visible");
      });
  }
}
