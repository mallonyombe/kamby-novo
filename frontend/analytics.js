const measurementId = 'G-XWTGWKM4XH';
const productionHost = 'kambymz.vercel.app';
const preferenceKey = 'kamby:analytics';
const disableKey = 'ga-disable-' + measurementId;
const analyticsCookies = ['_ga', '_ga_' + measurementId.slice(2)];
const deniedConsent = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
};
const eventNames = new Set(['page_view', 'view_item', 'view_store', 'add_to_cart', 'whatsapp_contact', 'pwa_install']);
let preferenceWriteFailed = false;

export function analyticsAllowed() {
  if (preferenceWriteFailed) return false;
  try {
    return localStorage.getItem(preferenceKey) === 'allow';
  } catch {
    return false;
  }
}

export function setAnalyticsAllowed(allowed) {
  try {
    localStorage.setItem(preferenceKey, allowed ? 'allow' : 'deny');
  } catch (error) {
    preferenceWriteFailed = true;
    syncAnalytics();
    throw error;
  }
  preferenceWriteFailed = false;
  syncAnalytics();
}

function clearAnalyticsCookies() {
  const expiry = 'Max-Age=0; Path=/; Secure; SameSite=Lax';
  try {
    for (const name of analyticsCookies) {
      document.cookie = name + '=; ' + expiry;
      document.cookie = name + '=; ' + expiry + '; Domain=' + productionHost;
    }
  } catch {
    // Browsers podem restringir o acesso a cookies. O envio continua bloqueado.
  }
}

function syncAnalytics() {
  if (location.protocol !== 'https:' || location.hostname !== productionHost) return false;
  const allowed = analyticsAllowed();
  const wasDisabled = window[disableKey] === true;
  window[disableKey] = !allowed;
  if (!allowed) {
    if (!wasDisabled) clearAnalyticsCookies();
    return false;
  }
  if (window.kambyAnalyticsStarted) return true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', deniedConsent);
  window.gtag('consent', 'update', { ...deniedConsent, analytics_storage: 'granted' });
  window.gtag('js', new Date());
  window.gtag('set', {
    page_location: location.origin + '/',
    page_referrer: '',
    page_title: 'Kamby'
  });
  window.gtag('config', measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: 'none',
    cookie_path: '/',
    cookie_flags: 'SameSite=Lax;Secure',
    cookie_expires: 30 * 24 * 60 * 60,
    cookie_update: false
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
