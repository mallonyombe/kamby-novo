export function parsePriceMinor(value) {
  const text = String(value).trim();
  if (!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(text)) throw new Error('Indica um preço válido, com até duas casas decimais.');
  const [whole, fraction=''] = text.replace(',','.').split('.');
  const minor = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(minor) || minor > 900000000000) throw new Error('O preço está acima do limite permitido.');
  return minor;
}
export function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0].toLocaleUpperCase('pt')).join('') || 'K';
}
export function signInIdentity(value) {
  const clean = String(value || '').trim();
  if (clean.includes('@')) return { email: clean };
  const digits = clean.replace(/\D/g,'');
  if (!/^\d{8,15}$/.test(digits)) throw new Error('Indica o telefone ou email da tua conta.');
  return { phone: '+' + (digits.length === 9 ? '258' + digits : digits) };
}

export class ProductValidationError extends Error {
  constructor(field,message) { super(message);this.field=field; }
}
export function validateProductPhoto(file) {
  const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if(!file) throw new ProductValidationError('image','Escolhe uma fotografia do artigo.');
  if(!extensions[file.type]) throw new ProductValidationError('image','Escolhe uma fotografia JPG, PNG ou WebP.');
  if(!Number.isInteger(file.size) || file.size<1 || file.size>5*1024*1024) throw new ProductValidationError('image','A fotografia deve ter até 5 MB.');
  return extensions[file.type];
}
export function normaliseNewProduct(input,file) {
  const title=String(input.title || '').trim();
  const description=String(input.description || '').trim();
  const optionName=String(input.optionName || '').trim();
  if(Array.from(title).length<2 || Array.from(title).length>160) throw new ProductValidationError('title','O nome deve ter entre 2 e 160 caracteres.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.categoryId || '')) throw new ProductValidationError('category','Selecciona uma categoria.');
  let priceMinor;try{priceMinor=parsePriceMinor(input.price);}catch(error){throw new ProductValidationError('price',error.message);}
  if(priceMinor<=0) throw new ProductValidationError('price','O preço deve ser superior a zero.');
  if(Array.from(optionName).length>120) throw new ProductValidationError('option','A opção deve ter até 120 caracteres.');
  if(Array.from(description).length>5000) throw new ProductValidationError('description','A descrição deve ter até 5000 caracteres.');
  return {title,categoryId:input.categoryId,priceMinor,optionName,description,extension:validateProductPhoto(file)};
}

// UI affordance only; the server remains authoritative for membership and writes.
export function canPrepareStore(store) {
  return ['draft', 'pending', 'approved'].includes(store?.status);
}

export function storeHoursDocument(original, edited, weekly) {
  return edited ? weekly : (Array.isArray(original) ? original : []);
}
