const measurementId = 'G-XWTGWKM4XH';
const productionHost = 'kambymz.vercel.app';
const preferenceKey = 'kamby:analytics';
const scopeKey = 'kamby:analytics-scope';
const currentScope = 'catalogue-and-google-v1';
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

export function analyticsChoice() {
  if (preferenceWriteFailed) return null;
  try {
    const choice = localStorage.getItem(preferenceKey);
    if (choice === 'deny') return false;
    if (choice === 'allow' && localStorage.getItem(scopeKey) === currentScope) return true;
  } catch {
    return null;
  }
  return null;
}

export function analyticsAllowed() {
  return analyticsChoice() === true;
}

export function setAnalyticsAllowed(allowed) {
  try {
    localStorage.setItem(preferenceKey, allowed ? 'allow' : 'deny');
    if (allowed) localStorage.setItem(scopeKey, currentScope);
  } catch (error) {
    preferenceWriteFailed = true;
    syncAnalytics();
    throw error;
  }
  preferenceWriteFailed = false;
  syncAnalytics();
  window.dispatchEvent?.(new Event('kamby:measurement-choice'));
}

export function bindMeasurementChoice(banner) {
  const notice = banner.querySelector('[role="status"]');
  function refresh() {
    banner.hidden = analyticsChoice() !== null;
  }
  function choose(allowed) {
    try {
      setAnalyticsAllowed(allowed);
      if (!allowed) {
        localStorage.setItem('kamby:search-history', 'off');
        for (const key of ['kamby:recent-searches', 'kamby:audience-device', 'kamby:audience-session']) {
          localStorage.removeItem(key);
        }
        window.dispatchEvent(new Event('kamby:search-history'));
      }
    } catch {
      notice.textContent = 'Não foi possível guardar a escolha. A medição continua desligada.';
    }
  }
  banner.querySelector('#rejectMeasurement').onclick = () => choose(false);
  banner.querySelector('#allowMeasurement').onclick = () => choose(true);
  window.addEventListener('kamby:measurement-choice', refresh);
  window.addEventListener('storage', refresh);
  refresh();
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
  if (document.documentElement?.dataset.pilot === 'true') return false;
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
    if (event.key === preferenceKey || event.key === scopeKey || event.key === null) syncAnalytics();
  });
}
