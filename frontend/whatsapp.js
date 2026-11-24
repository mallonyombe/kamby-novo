export function isTestContact(testStore, phone) {
 const digits = String(phone || '').replace(/\D/g, '');
 return Boolean(testStore || digits === '12025550101' || digits === '12025550102');
}

export function whatsappURL(phone, message) {
 const digits = String(phone || '').replace(/\D/g, '');
 if (!/^[1-9]\d{6,14}$/.test(digits)) throw new Error('O número de WhatsApp da loja é inválido.');
 return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(message);
}
