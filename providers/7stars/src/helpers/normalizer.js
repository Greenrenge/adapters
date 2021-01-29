export const text = s =>
  (s || '')
    .split(/[\n\s+\t+]/g)
    .filter(a => !!a)
    .join(' ')

export const float = s => parseFloat((s || '').replace(/,/g, '')) || 0

export const number = s => +(s || '') || 0
