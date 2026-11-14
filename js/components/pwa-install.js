/**
 * Composant Installation WebApp (PWA) :
 * - Supprime le bouton d'installation lorsque l'app tourne en mode standalone (iOS / Android)
 * - Gère `beforeinstallprompt` (Android) et la modale guide Safari/Chrome
 */

export function initPwaInstall(dom) {
  let deferredInstallPrompt = null;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true;

  const removeInstallButton = () => {
    if (dom.btnInstallApp) {
      dom.btnInstallApp.remove();
      dom.btnInstallApp = null;
    }
  };

  if (isStandalone) {
    removeInstallButton();
  } else if (typeof navigator.getInstalledRelatedApps === "function") {
    navigator
      .getInstalledRelatedApps()
      .then((apps) => {
        if (Array.isArray(apps) && apps.length > 0) {
          removeInstallButton();
        }
      })
      .catch(() => {});
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (dom.btnInstallApp && !isStandalone) dom.btnInstallApp.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    removeInstallButton();
  });

  if (dom.btnInstallApp) {
    dom.btnInstallApp.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === "accepted") {
          deferredInstallPrompt = null;
        }
        return;
      }
      if (dom.pwaInstallDialog && typeof dom.pwaInstallDialog.showModal === "function") {
        dom.pwaInstallDialog.showModal();
      }
    });
  }

  if (dom.pwaInstallDialog) {
    dom.pwaInstallDialog.addEventListener("close", () => {
      dom.pwaInstallDialog.returnValue = "";
    });
  }
}
