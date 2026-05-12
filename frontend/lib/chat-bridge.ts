/**
 * Opens the global Ask Simulyn drawer (wired in Shell). Optional message seeds
 * the composer — used from dashboard shortcuts without coupling to Shell state.
 */
export function openAskSimulyn(message?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("simulyn:open-chat", { detail: { message: message?.trim() || undefined } }),
  );
}
