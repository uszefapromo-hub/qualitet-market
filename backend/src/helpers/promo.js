'use strict';

/**
 * Promotional registration tier logic.
 *
 * The platform automatically grants free subscription months to early adopters:
 *   – First  10 sellers registered  → 12 months free
 *   – Next   10 sellers (11-20)     →  6 months free
 *   – Next   10 sellers (21-30)     →  3 months free
 *   – Next   70 sellers (31-100)    →  1 month  free  ← first-100 launch promo
 *   – All subsequent sellers        → standard trial (14 days)
 */

/** Tiers ordered from most generous to least. */
const PROMO_TIERS = [
  { upToCount: 10,  bonusMonths: 12, label: 'Tier 1 – 12 miesięcy gratis' },
  { upToCount: 20,  bonusMonths: 6,  label: 'Tier 2 – 6 miesięcy gratis'  },
  { upToCount: 30,  bonusMonths: 3,  label: 'Tier 3 – 3 miesiące gratis'  },
  { upToCount: 100, bonusMonths: 1,  label: 'Tier 4 – 1 miesiąc gratis (pierwsza setka)'  },
];

const DAYS_PER_MONTH = 30;

/**
 * Determine the promotional bonus for the nth seller.
 *
 * @param {number} currentSellerCount – number of sellers registered BEFORE this user (0-indexed)
 * @returns {{ bonusMonths: number, durationDays: number, label: string }}
 */
function getPromoTier(currentSellerCount) {
  for (const tier of PROMO_TIERS) {
    if (currentSellerCount < tier.upToCount) {
      return {
        bonusMonths:  tier.bonusMonths,
        durationDays: tier.bonusMonths * DAYS_PER_MONTH,
        label:        tier.label,
      };
    }
  }
  // No promotional tier – return standard trial
  return {
    bonusMonths:  0,
    durationDays: 14,  // standard trial
    label:        'Trial standardowy',
  };
}

/**
 * How many promotional slots remain at each tier.
 *
 * @param {number} totalSellers – current total number of registered sellers
 * @returns {Array<{ label: string, upToCount: number, bonusMonths: number, slotsLeft: number }>}
 */
function getPromoSlots(totalSellers) {
  return PROMO_TIERS.map((tier) => ({
    label:       tier.label,
    upToCount:   tier.upToCount,
    bonusMonths: tier.bonusMonths,
    slotsLeft:   Math.max(0, tier.upToCount - totalSellers),
  }));
}

module.exports = { getPromoTier, getPromoSlots, PROMO_TIERS };
