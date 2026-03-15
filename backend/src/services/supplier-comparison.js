'use strict';

/**
 * Supplier Comparison Service
 *
 * When the same product (matched by SKU, EAN, or MPN) is available from
 * multiple suppliers, this service compares all offers and selects the best
 * source according to the requested mode.
 *
 * Selection modes:
 *   'lowest_cost'   – pick the supplier with the lowest supplier_price
 *   'best_margin'   – pick the supplier that yields the highest platform profit
 *   'best_quality'  – pick the supplier with the highest quality_score
 *   'balanced'      – default; weighted score combining margin + quality + stock
 *
 * Input shape (candidate):
 *   {
 *     supplier_id:    string,
 *     supplier_name:  string,
 *     supplier_price: number,   // gross cost from this supplier
 *     stock:          number,
 *     quality_score:  number,   // 0-100 from computeQualityScore
 *     platform_price: number,   // platform_price computed for this supplier's cost
 *   }
 *
 * Output:
 *   {
 *     best: candidate,
 *     alternatives: candidate[],  // remaining candidates, best-first
 *     mode: string,
 *     scores: { [supplier_id]: number }
 *   }
 */

// ─── Score weights for 'balanced' mode ────────────────────────────────────────
const WEIGHT_MARGIN  = 0.50;  // 50 % of composite score
const WEIGHT_QUALITY = 0.30;  // 30 %
const WEIGHT_STOCK   = 0.20;  // 20 %

// Within the WEIGHT_MARGIN component, cost savings and gross margin are equally weighted
const MARGIN_COST_SPLIT = 0.5;

const STOCK_SATURATION = 100; // stock ≥ this value is treated as "full"

/**
 * Normalise a value to [0, 1] given min/max bounds.
 * Returns 0 when max === min to avoid division by zero.
 */
function normalize(value, min, max) {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Select the best supplier from an array of candidates.
 *
 * @param {object[]} candidates  Array of supplier offer objects (see above).
 * @param {string}   mode        'lowest_cost' | 'best_margin' | 'best_quality' | 'balanced'
 * @returns {{ best: object, alternatives: object[], mode: string, scores: object }}
 * @throws {Error} when candidates array is empty.
 */
function selectBestSupplier(candidates, mode = 'balanced') {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('selectBestSupplier: candidates array must not be empty');
  }

  if (candidates.length === 1) {
    return {
      best:         candidates[0],
      alternatives: [],
      mode,
      scores:       { [candidates[0].supplier_id]: 1 },
    };
  }

  let sorted;
  const scores = {};

  if (mode === 'lowest_cost') {
    sorted = [...candidates].sort(
      (a, b) => (parseFloat(a.supplier_price) || 0) - (parseFloat(b.supplier_price) || 0)
    );
    for (const c of sorted) scores[c.supplier_id] = parseFloat(c.supplier_price) || 0;

  } else if (mode === 'best_margin') {
    // Best margin = highest (platform_price - supplier_price)
    sorted = [...candidates].sort((a, b) => {
      const profitA = (parseFloat(a.platform_price) || 0) - (parseFloat(a.supplier_price) || 0);
      const profitB = (parseFloat(b.platform_price) || 0) - (parseFloat(b.supplier_price) || 0);
      return profitB - profitA;
    });
    for (const c of sorted) {
      scores[c.supplier_id] = (parseFloat(c.platform_price) || 0) - (parseFloat(c.supplier_price) || 0);
    }

  } else if (mode === 'best_quality') {
    sorted = [...candidates].sort(
      (a, b) => (parseFloat(b.quality_score) || 0) - (parseFloat(a.quality_score) || 0)
    );
    for (const c of sorted) scores[c.supplier_id] = parseFloat(c.quality_score) || 0;

  } else {
    // 'balanced' (default)
    // Compute min/max for normalisation across all candidates
    const prices   = candidates.map((c) => parseFloat(c.supplier_price) || 0);
    const margins  = candidates.map((c) => (parseFloat(c.platform_price) || 0) - (parseFloat(c.supplier_price) || 0));
    const qualities = candidates.map((c) => parseFloat(c.quality_score) || 0);
    const stocks   = candidates.map((c) => Math.min(parseFloat(c.stock) || 0, STOCK_SATURATION));

    const minPrice   = Math.min(...prices);
    const maxPrice   = Math.max(...prices);
    const minMargin  = Math.min(...margins);
    const maxMargin  = Math.max(...margins);
    const minQuality = Math.min(...qualities);
    const maxQuality = Math.max(...qualities);
    const minStock   = Math.min(...stocks);
    const maxStock   = Math.max(...stocks);

    for (const c of candidates) {
      const price   = parseFloat(c.supplier_price) || 0;
      const margin  = (parseFloat(c.platform_price) || 0) - price;
      const quality = parseFloat(c.quality_score) || 0;
      const stock   = Math.min(parseFloat(c.stock) || 0, STOCK_SATURATION);

      // For cost: lower is better → invert normalisation
      const costScore    = 1 - normalize(price, minPrice, maxPrice);
      const marginScore  = normalize(margin, minMargin, maxMargin);
      const qualScore    = normalize(quality, minQuality, maxQuality);
      const stockScore   = normalize(stock, minStock, maxStock);

      // Composite: favour margin + quality heavily, penalise high cost
      const composite = WEIGHT_MARGIN  * ((marginScore + costScore) * MARGIN_COST_SPLIT) +
                        WEIGHT_QUALITY * qualScore +
                        WEIGHT_STOCK   * stockScore;

      scores[c.supplier_id] = parseFloat(composite.toFixed(4));
    }

    sorted = [...candidates].sort(
      (a, b) => (scores[b.supplier_id] || 0) - (scores[a.supplier_id] || 0)
    );
  }

  const [best, ...alternatives] = sorted;
  return { best, alternatives, mode, scores };
}

/**
 * Build a compact alternative-suppliers summary suitable for storing in the
 * `alternative_suppliers` JSONB column.
 *
 * @param {object[]} alternatives  Array of non-selected candidates.
 * @returns {object[]} Serialisable array for JSONB storage.
 */
function buildAlternativesSummary(alternatives) {
  return alternatives.map((c) => ({
    supplier_id:    c.supplier_id,
    supplier_name:  c.supplier_name || null,
    supplier_price: parseFloat(c.supplier_price) || 0,
    stock:          parseInt(c.stock, 10) || 0,
    quality_score:  parseInt(c.quality_score, 10) || 0,
  }));
}

module.exports = { selectBestSupplier, buildAlternativesSummary };
