import { showToast } from "./toast.js?h=9e676138";

const UPDATED_KEY = "kawari:updated";

function announcePendingUpdate() {
  try {
    if (sessionStorage.getItem(UPDATED_KEY) === null) return;
    sessionStorage.removeItem(UPDATED_KEY);
  } catch {
    return;
  }
  showToast("Updated to the latest version.");
}

function applyUpdate() {
  try {
    sessionStorage.setItem(UPDATED_KEY, "1");
  } catch {
    // Losing the flag costs the notice, not the update.
  }
  window.location.reload();
}

if ("serviceWorker" in navigator) {
  announcePendingUpdate();
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        const replacesRunningVersion = !!navigator.serviceWorker.controller;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "activated" && replacesRunningVersion) {
            showToast("New version ready.", {
              actionLabel: "Reload",
              onAction: applyUpdate,
              duration: null,
            });
          }
        });
      });
    } catch (error) {
      console.error("ServiceWorker registration failed:", error);
    }
  });
}
