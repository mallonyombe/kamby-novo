const measurementId = 'G-XWTGWKM4XH';
const productionHost = 'kambymz.vercel.app';
const preferenceKey = 'kamby:analytics';
const eventNames = new Set(['page_view', 'view_item', 'view_store', 'add_to_cart', 'whatsapp_contact', 'pwa_install']);

export function analyticsAllowed() {
  try {
    return localStorage.getItem(preferenceKey) === 'allow';
  } catch {
    return false;
  }
}

export function setAnalyticsAllowed(allowed) {
  localStorage.setItem(preferenceKey, allowed ? 'allow' : 'deny');
  syncAnalytics();
}

function syncAnalytics() {
  if (location.protocol !== 'https:' || location.hostname !== productionHost) return false;
  const allowed = analyticsAllowed();
  window['ga-disable-' + measurementId] = !allowed;
  if (!allowed) return false;
  if (window.kambyAnalyticsStarted) return true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('set', {
    page_location: location.origin + '/',
    page_referrer: '',
    page_title: 'Kamby'
  });
  window.gtag('config', measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  const tag = document.createElement('script');
  tag.async = true;
  tag.referrerPolicy = 'no-referrer';
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.append(tag);
  window.kambyAnalyticsStarted = true;
  window.gtag('event', 'page_view', { send_to: measurementId });
  return true;
}

export function trackAnalytics(event) {
  if (eventNames.has(event) && syncAnalytics()) {
    window.gtag('event', event, { send_to: measurementId });
  }
}

export function startAnalytics() {
  syncAnalytics();
  window.addEventListener('storage', event => {
    if (event.key === preferenceKey || event.key === null) syncAnalytics();
  });
}
