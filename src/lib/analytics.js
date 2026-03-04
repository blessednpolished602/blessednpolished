// Thin wrapper around GA4 gtag — safe to call before the script loads
export function trackEvent(name, params = {}) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", name, params);
}
