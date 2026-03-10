/* js/planGuard.js
   GitHub Pages safe. No absolute paths. No HTML.
   Guards UI sections/links by subscription plan using data-require="pro|elite".
*/
(() => {
  "use strict";

  // Plan order: basic < pro < elite
  const PLAN_RANK = { basic: 1, pro: 2, elite: 3 };

  function normalizePlan(plan) {
    const p = String(plan || "").trim().toLowerCase();
    return PLAN_RANK[p] ? p : "basic";
  }

  // Where we read the current plan from (supports a few keys to be resilient)
  function readPlan() {
    const keys = [
      "plan",                // simplest
      "subscriptionPlan",    // common
      "userPlan",            // common
      "uszefa_plan",         // fallback
      "qualitet_plan"        // fallback
    ];

    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v) return normalizePlan(v);
    }
    return "basic";
  }

  function hasAccess(userPlan, requiredPlan) {
    const u = PLAN_RANK[normalizePlan(userPlan)];
    const r = PLAN_RANK[normalizePlan(requiredPlan)];
    return u >= r;
  }

  function applyGuard() {
    const userPlan = readPlan();

    // Optionally expose for debugging / other scripts
    window.__USER_PLAN__ = userPlan;

    const guarded = document.querySelectorAll("[data-require]");
    guarded.forEach((el) => {
      const required = normalizePlan(el.getAttribute("data-require"));
      const allowed = hasAccess(userPlan, required);

      if (allowed) {
        el.removeAttribute("aria-disabled");
        el.classList.remove("locked");
        // If it was previously hidden by us
        if (el.dataset.planGuardHidden === "1") {
          el.style.removeProperty("display");
          delete el.dataset.planGuardHidden;
        }
        return;
      }

      // Block interaction for links/buttons, hide other blocks
      const tag = el.tagName.toLowerCase();
      const isClickable =
        tag === "a" ||
        tag === "button" ||
        el.hasAttribute("role") ||
        typeof el.onclick === "function";

      if (isClickable) {
        el.setAttribute("aria-disabled", "true");
        el.classList.add("locked");

        // If it's a link, prevent navigation
        if (tag === "a") {
          el.addEventListener(
            "click",
            (e) => {
              e.preventDefault();
              e.stopPropagation();
              alert(
                `Ta funkcja wymaga planu: ${required.toUpperCase()}.\nTwój plan: ${userPlan.toUpperCase()}.`
              );
            },
            { capture: true }
          );
        } else {
          el.addEventListener(
            "click",
            (e) => {
              e.preventDefault();
              e.stopPropagation();
              alert(
                `Ta funkcja wymaga planu: ${required.toUpperCase()}.\nTwój plan: ${userPlan.toUpperCase()}.`
              );
            },
            { capture: true }
          );
        }
      } else {
        // Default: hide sections that require higher plan
        el.dataset.planGuardHidden = "1";
        el.style.display = "none";
      }
    });

    // Optional: also guard links that explicitly declare required plan
    // Example: <a href="..." data-require="pro">...</a> handled above already.
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyGuard);
  } else {
    applyGuard();
  }

  // Re-apply if some other script changes plan in localStorage
  window.addEventListener("storage", (e) => {
    if (!e) return;
    // If any of our plan keys changed, re-apply
    const watched = new Set([
      "plan",
      "subscriptionPlan",
      "userPlan",
      "uszefa_plan",
      "qualitet_plan"
    ]);
    if (watched.has(e.key)) applyGuard();
  });
})();