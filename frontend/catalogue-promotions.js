export function promotionPriceAt(item, now = Date.now()) {
  const listed = Number(item.price_minor) || 0;
  const regular = Number(item.previous_price_minor) || 0;
  if (regular <= listed) return listed;
  const starts = item.promotion_starts_at && Date.parse(item.promotion_starts_at);
  const ends = item.promotion_ends_at && Date.parse(item.promotion_ends_at);
  return (starts && now < starts) || (ends && now >= ends) ? regular : listed;
}

export function effectiveCataloguePath(path) {
  const url = new URL(path, 'https://catalogue.invalid');
  if (!['/rest/v1/kg_products', '/rest/v1/kg_stores'].includes(url.pathname)) return path;
  const select = url.searchParams.get('select');
  if (!select) return path;
  const effective = select.replace(/(^|[,(])(previous_price_minor|price_minor)(?=[,)]|$)/g,
    (_, separator, name) => separator + name + ':effective_' + name);
  if (effective === select) return path;
  url.searchParams.set('select', effective);
  return url.pathname + '?' + url.searchParams.toString();
}
