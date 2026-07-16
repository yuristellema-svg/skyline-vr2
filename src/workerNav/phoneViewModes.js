const PHONE_SEQUENCE = Object.freeze(['cockpit', 'third']);
const DESKTOP_SEQUENCE = Object.freeze(['first', 'cockpit', 'third']);

export function normalizeViewMode(mode, { phone = false } = {}) {
  const sequence = phone ? PHONE_SEQUENCE : DESKTOP_SEQUENCE;
  return sequence.includes(mode) ? mode : sequence[0];
}

export function initialViewMode({ phone = false } = {}) {
  return phone ? 'cockpit' : 'first';
}

export function nextViewMode(mode, { phone = false } = {}) {
  const sequence = phone ? PHONE_SEQUENCE : DESKTOP_SEQUENCE;
  const normalized = normalizeViewMode(mode, { phone });
  return sequence[(sequence.indexOf(normalized) + 1) % sequence.length];
}

export function viewSequence({ phone = false } = {}) {
  return [...(phone ? PHONE_SEQUENCE : DESKTOP_SEQUENCE)];
}
