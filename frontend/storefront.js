import {formatOpeningHours} from './store-availability.js';
import { filterStoreProducts } from './storefront-domain.js';
import { resolveStoreArtwork } from './storefront-artwork.js';

export function setupStorefrontDiscovery({ renderCard, createEmpty }) {
  const $ = id => document.getElementById(id);
  const view = $('viewStorefront');
  const field = $('storefrontSearchInput');
  const panel = $('storefrontSearchPanel');
  const navigation = view.querySelector('.pdp-nav-content');
  const searchButton = $('btnSearchStorefront');
  const sortButton = $('btnStorefrontSort');
  const sortMenu = $('storefrontSortMenu');
  const info = $('storefrontInfoDialog');
  const labels = { recent: 'Mais recentes', 'price-up': 'Menor preço', 'price-down': 'Maior preço' };
  let store = null;
  let state = { query: '', availableOnly: false, sort: 'recent' };
  let searchOrigin = 0;
  let timer = 0;
  let generation = 0;

  function renderResults() {
    if (!store) return;
    clearTimeout(timer);
    const products = filterStoreProducts(store, state);
    const grid = $('storefrontProductsGrid');
    grid.replaceChildren();
    $('storefrontCatalogCount').textContent = 'Produtos';
    $('storefrontResultCount').textContent = state.query.trim() || state.availableOnly
      ? products.length + ' de ' + store.products.length
      : String(products.length);
    $('storefrontResultsStatus').textContent = products.length + (products.length === 1 ? ' produto' : ' produtos') + ' nesta loja';
    $('btnClearStorefrontSearch').hidden = !field.value;
    $('storefrontAvailable').setAttribute('aria-pressed', String(state.availableOnly));
    sortButton.setAttribute('aria-label', 'Ordenar produtos: ' + labels[state.sort]);
    $('storefrontSortLabel').textContent = labels[state.sort];
    for (const button of sortMenu.querySelectorAll('button')) button.setAttribute('aria-checked', String(button.dataset.sort === state.sort));
    if (!products.length) {
      const empty = createEmpty(store.products.length ? 'Nenhum produto encontrado' : 'Sem produtos publicados',
        store.products.length ? 'Experimenta outro nome ou limpa os filtros.' : 'Os produtos desta loja aparecerão aqui.',
        store.products.length ? 'Limpar pesquisa e filtros' : '', store.products.length ? clearFilters : null);
      grid.append(empty);
    } else {
      products.forEach((product, index) => {
        const card = renderCard(product, index);
        card.querySelector('.product-store-badge')?.remove();
        grid.append(card);
      });
    }
  }

  function clearFilters() {
    field.value = '';
    state.query = '';
    state.availableOnly = false;
    renderResults();
    if (!panel.hidden) field.focus({ preventScroll: true });
  }
  function closeSort() { sortMenu.hidden = true; sortButton.setAttribute('aria-expanded', 'false'); }
  function openSearch() {
    if (!store) return;
    closeSort();
    if (panel.hidden) searchOrigin = view.scrollTop;
    panel.hidden = false;
    navigation.hidden = true;
    view.classList.add('is-store-searching');
    $('storefrontHeaderTitle').textContent = store.name;
    searchButton.setAttribute('aria-expanded', 'true');
    view.scrollTo({ top: 0, behavior: 'auto' });
    field.focus({ preventScroll: true });
  }
  function closeSearch() {
    clearTimeout(timer);
    field.blur();
    field.value = '';
    state.query = '';
    panel.hidden = true;
    navigation.hidden = false;
    view.classList.remove('is-store-searching');
    $('storefrontHeaderTitle').textContent = 'Loja';
    searchButton.setAttribute('aria-expanded', 'false');
    renderResults();
    view.scrollTo({ top: searchOrigin, behavior: 'auto' });
    searchButton.focus({ preventScroll: true });
  }
  searchButton.onclick = openSearch;
  $('btnCancelStorefrontSearch').onclick = closeSearch;
  $('btnClearStorefrontSearch').onclick = () => { field.value = ''; state.query = ''; renderResults(); field.focus({ preventScroll: true }); };
  field.oninput = () => {
    state.query = field.value;
    $('btnClearStorefrontSearch').hidden = !field.value;
    clearTimeout(timer);
    const current = generation;
    timer = setTimeout(() => { if (current === generation) renderResults(); }, 120);
  };
  field.onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); closeSearch(); } };
  panel.onsubmit = event => { event.preventDefault(); renderResults(); field.blur(); };
  $('storefrontAvailable').onclick = () => { state.availableOnly = !state.availableOnly; renderResults(); };
  sortButton.onclick = () => {
    sortMenu.hidden = !sortMenu.hidden;
    sortButton.setAttribute('aria-expanded', String(!sortMenu.hidden));
    if (!sortMenu.hidden) sortMenu.querySelector('[aria-checked="true"]').focus();
  };
  for (const button of sortMenu.querySelectorAll('button')) button.onclick = () => {
    state.sort = button.dataset.sort;
    closeSort(); renderResults(); sortButton.focus({ preventScroll: true });
  };
  sortMenu.onkeydown = event => {
    const buttons = [...sortMenu.querySelectorAll('button')];
    if (event.key === 'Escape') { event.preventDefault(); closeSort(); sortButton.focus(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      let index = buttons.indexOf(document.activeElement);
      index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index].focus();
    }
  };
  document.addEventListener('click', event => { if (!sortMenu.hidden && !sortMenu.contains(event.target) && !sortButton.contains(event.target)) closeSort(); });
  $('btnStorefrontInfo').onclick = () => { closeSort(); info.showModal(); };
  $('btnCloseStorefrontInfo').onclick = () => info.close();

  function renderInfo() {
    $('storefrontInfoTitle').textContent = store.name;
    const body = $('storefrontInfoContent'); body.replaceChildren();
    function section(title, copy) {
      if (!copy) return;
      const block = document.createElement('section'), heading = document.createElement('h3'), text = document.createElement('p');
      heading.textContent = title; text.textContent = copy; block.append(heading, text); body.append(block);
    }
    section('Sobre a loja', store.description);
    section('Localização', [store.location, store.address].filter(Boolean).join('\n'));
    section('Área de atendimento', store.serviceArea);
    section('Horário · Maputo', formatOpeningHours(store.openingHours));
  }
  function renderArtwork() {
    const artwork = resolveStoreArtwork(store);
    const cover = $('storefrontCover'), avatar = $('storefrontAvatar');
    cover.replaceChildren(); avatar.replaceChildren();
    cover.disabled = avatar.disabled = true;
    cover.onclick = avatar.onclick = null;
    const storeName = store.name;
    function openArtwork(url, label) {
      const dialog = $('storeArtworkViewer');
      const image = $('storeArtworkFull');
      dialog.setAttribute('aria-label', label + ' · ' + storeName);
      image.alt = label + ' de ' + storeName;
      image.src = url;
      dialog.showModal();
    }
    const fallback = document.createElement('span');
    fallback.className = 'storefront-avatar-fallback'; fallback.textContent = store.initials;
    avatar.append(fallback);
    if (artwork.cover) {
      const image = document.createElement('img'); image.src = artwork.cover; image.alt = '';
      image.decoding = 'async'; image.fetchPriority = 'high'; image.style.objectPosition = artwork.coverPosition;
      image.onload = () => { if (image.parentElement === cover) cover.disabled = false; };
      image.onerror = () => { if (image.parentElement === cover) cover.disabled = true; image.remove(); };
      cover.onclick = () => openArtwork(artwork.cover, 'Foto de capa');
      cover.append(image);
    }
    if (artwork.avatar) {
      const image = document.createElement('img'); image.src = artwork.avatar; image.alt = '';
      image.decoding = 'async'; image.style.objectPosition = artwork.avatarPosition; image.style.objectFit = artwork.avatarFit;
      image.onload = () => { if (image.parentElement === avatar) { fallback.hidden = true; avatar.disabled = false; } };
      image.onerror = () => { if (image.parentElement === avatar) avatar.disabled = true; image.remove(); fallback.hidden = false; };
      avatar.onclick = () => openArtwork(artwork.avatar, 'Foto de perfil');
      avatar.append(image);
    }
  }
  return {
    render(nextStore) {
      generation++;
      if (store?.id !== nextStore.id) {
        state = { query: '', availableOnly: false, sort: 'recent' }; field.value = ''; panel.hidden = true;
        view.classList.remove('is-store-searching');
        searchButton.setAttribute('aria-expanded', 'false');
      }
      store = nextStore;
      navigation.hidden = !panel.hidden;
      $('storefrontHeaderTitle').textContent = panel.hidden ? 'Loja' : store.name;
      field.placeholder = 'Pesquisar em ' + store.name;
      field.setAttribute('aria-label', 'Pesquisar produtos de ' + store.name);
      renderArtwork(); renderInfo(); closeSort(); renderResults();
    },
    leave() { generation++; clearTimeout(timer); field.blur(); closeSort(); if (info.open) info.close(); }
  };
}
