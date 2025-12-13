// integrations/goatcounter-inline.js
export default function goatcounterInline(opts = {}) {
  const {
    endpoint = process.env.GOATCOUNTER_ENDPOINT || "https://stats.foxx.pet/count",
    enabled = process.env.GOATCOUNTER_ENABLED || false,
    fallbackPath = process.env.GOATCOUNTER_FALLBACK || "/var/www/shared/goatcounter/count.js",
  } = opts;

  return {
    name: "goatcounter-inline",
    hooks: {
      "astro:config:setup": async ({ injectScript, logger }) => {
        if (!enabled) {
          logger.info("goatcounter-inline: disabled (enabled=false)");
          return;
        }

        const jsURL = new URL(
          (endpoint.endsWith("/count") ? endpoint.slice(0, -"/count".length) : endpoint)
          + "/count.js"
        );

        let code = null;
        try {
          const res = await fetch(jsURL);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          code = await res.text();
          logger.info(`goatcounter-inline: fetched ${jsURL.href}`);
        } catch (e) {
          logger.warn(`goatcounter-inline: fetch failed (${e.message})`);
          if (fallbackPath) {
            try {
              const fs = await import("node:fs/promises");
              code = await fs.readFile(fallbackPath, "utf8");
              logger.info(`goatcounter-inline: using fallback ${fallbackPath}`);
            } catch (e2) {
              logger.warn(`goatcounter-inline: fallback failed (${e2.message})`);
            }
          }
        }

        if (!code) {
          logger.warn("goatcounter-inline: no code injected (fetch + fallback failed)");
          return;
        }

        const snippet = `
          // GoatCounter inline (self-hosted)
          window.goatcounter = { endpoint: ${JSON.stringify(endpoint)} };
          ${code}
        `;
        injectScript("page", snippet);
      },
    },
  };
}
