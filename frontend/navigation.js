// Back/forward can change the path or query as well as the fragment.
// A fragment traversal raises both events for the same destination.
export function listenForNavigation(browser, navigate) {
  let traversedURL = '';
  browser.addEventListener('popstate', () => {
    traversedURL = browser.location.href;
    navigate();
  });
  browser.addEventListener('hashchange', event => {
    const handled = event.newURL === traversedURL;
    traversedURL = '';
    if (!handled) navigate();
  });
}
