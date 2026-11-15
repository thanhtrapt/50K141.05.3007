export const nowIso = () => new Date().toISOString();

export function normalizeVietnamese(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi-VN').trim();
}

export function paginate(items, page = 1, limit = 20) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;
  return { data: items.slice(offset, offset + safeLimit), meta: { page:safePage, limit:safeLimit, total:items.length, totalPages:Math.ceil(items.length / safeLimit) } };
}

export function parseDate(value, field, errors, label) {
  const parsed=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(`${value}T00:00:00Z`):null;
  if (!parsed || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0,10)!==value) {
    errors.push({ field, message:`${label} không hợp lệ` });
    return null;
  }
  return value;
}

export function newCode(prefix, number) {
  return `${prefix}-${String(number).padStart(6, '0')}`;
}

export function idempotentCode(prefix, date, counter) {
  return `${prefix}-${date.replaceAll('-','')}-${String(counter).padStart(3,'0')}`;
}
