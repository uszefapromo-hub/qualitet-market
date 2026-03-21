'use strict';

/**
 * Product Auto-Import Engine
 *
 * Continuously fetches products from all registered wholesaler connectors,
 * normalizes, deduplicates, filters, scores, and upserts them into the
 * central product catalogue.
 *
 * Pipeline:
 *   FETCH (all connectors)
 *   → NORMALIZE + DEDUPLICATE (normalizer.js)
 *   → FILTER out rejects (no image, no name, price ≤ 20, no stock, etc.)
 *   → SCORE + PROFITABILITY FILTER (scoring.js)
 *   → UPSERT to DB (sync.js)
 *
 * Auto-refresh: call startEngine() to begin the 5-minute loop.
 *
 * Exported:
 *   runImportCycle()   – run one full pipeline cycle
 *   startEngine()      – start the 5-minute interval loop
 *   CYCLE_INTERVAL_MS  – interval between cycles (exported for tests)
 */

const connectors         = require('../integrations/wholesalers/index');
const { normalizeProducts } = require('./normalizer');
const { scoreAndSort }   = require('./scoring');
const { upsertImportedProduct } = require('./sync');

const CYCLE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Run one full import pipeline cycle:
 *   1. Fetch from all connectors (errors per connector are caught; others continue)
 *   2. Normalize + deduplicate
 *   3. Score and profitability-filter
 *   4. Upsert to DB
 *
 * @returns {Promise<{
 *   sources: string[],
 *   fetched: number,
 *   normalized: number,
 *   scored: number,
 *   saved: number,
 *   errors: number
 * }>}
 */
async function runImportCycle() {
  const summary = {
    sources:    [],
    fetched:    0,
    normalized: 0,
    scored:     0,
    saved:      0,
    errors:     0,
  };

  // ── Step 1: Fetch from all connectors ────────────────────────────────────
  const rawAll = [];

  for (const connector of connectors) {
    try {
      const items = await connector.fetchProducts();
      rawAll.push(...items);
      summary.sources.push(connector.SOURCE);
      summary.fetched += items.length;
    } catch (err) {
      summary.errors++;
      console.error(`[import-engine] Connector "${connector.SOURCE}" error:`, err.message);
    }
  }

  // ── Step 2: Normalize + deduplicate ──────────────────────────────────────
  const normalized = normalizeProducts(rawAll);
  summary.normalized = normalized.length;

  // ── Step 3: Score + profitability filter ─────────────────────────────────
  const scored = scoreAndSort(normalized);
  summary.scored = scored.length;

  // ── Step 4: Upsert to DB ─────────────────────────────────────────────────
  for (const product of scored) {
    try {
      await upsertImportedProduct(product);
      summary.saved++;
    } catch (err) {
      summary.errors++;
      console.error(
        `[import-engine] Failed to save "${product.name}" (${product.source}:${product.external_id}):`,
        err.message
      );
    }
  }

  console.log(
    `[import-engine] Cycle complete – sources: [${summary.sources.join(', ')}], ` +
    `fetched: ${summary.fetched}, normalized: ${summary.normalized}, ` +
    `scored: ${summary.scored}, saved: ${summary.saved}, errors: ${summary.errors}`
  );

  return summary;
}

/**
 * Start the automatic import cycle.
 * Runs runImportCycle() immediately and then every CYCLE_INTERVAL_MS ms.
 *
 * @returns {NodeJS.Timeout}  The interval handle (use clearInterval to stop).
 */
function startEngine() {
  runImportCycle().catch((err) => {
    console.error('[import-engine] Initial cycle error:', err.message);
  });

  const handle = setInterval(() => {
    runImportCycle().catch((err) => {
      console.error('[import-engine] Scheduled cycle error:', err.message);
    });
  }, CYCLE_INTERVAL_MS);

  return handle;
}

module.exports = { runImportCycle, startEngine, CYCLE_INTERVAL_MS };
