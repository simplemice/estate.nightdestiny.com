// Rental business rules, kept in one place so they can be changed later.
// Used by scripts/build.mjs at build time (cards, detail pages, form data attributes) and mirrored into the page as
// data-* attributes for js/rental.js (which therefore never hard-codes the rule).

// Initial business rule: up to 2 recommended guests per bedroom. This is a recommended capacity, NOT a legally
// confirmed occupancy limit. Set `maxGuests` on a rental entry (content/properties/rent/*.json) to override it with a
// verified limit.
export const GUESTS_PER_BEDROOM = 2;

export function guestCapacity(entry) {
  const verified = Number(entry?.maxGuests);
  if (Number.isFinite(verified) && verified > 0) return { max: Math.floor(verified), verified: true };
  const beds = entry?.bedrooms;
  if (beds === undefined || beds === null || beds === '') return null; // unknown bedrooms: do not invent a capacity
  const n = Number(beds);
  if (!Number.isFinite(n) || n < 1) return null; // studio / unknown
  return { max: Math.floor(n) * GUESTS_PER_BEDROOM, verified: false };
}

// Preferred-location choices on the inquiry form (slug -> English label; Russian labels live in ui.json as
// "rental.loc.<slug>"). Add or remove entries here only; the form is generated from this list.
export const RENTAL_LOCATIONS = ['bang-tao', 'laguna', 'surin', 'kamala', 'patong', 'karon', 'kata', 'nai-harn', 'rawai', 'chalong', 'other'];
export const LOCATION_LABELS = {
  'bang-tao': 'Bang Tao', laguna: 'Laguna', surin: 'Surin', kamala: 'Kamala', patong: 'Patong', karon: 'Karon', kata: 'Kata',
  'nai-harn': 'Nai Harn', rawai: 'Rawai', chalong: 'Chalong', other: 'Other',
};

export const BUDGET_CURRENCIES = ['THB', 'USD', 'EUR', 'RUB'];
export const BUDGET_PERIODS = ['night', 'week', 'month', 'total'];
