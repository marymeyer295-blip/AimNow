import { callLLM } from './llmService.js';

/**
 * Domain Enrichment Service
 * Fetches the domain's website HTML (Option A), strips it to plain text,
 * then calls the LLM to extract structured business details.
 */

const VALID_INDUSTRIES = [
  'FMCG / Snacks / Beverages',
  'Pet Care',
  'Beauty / Skincare',
  'Wellness / Nutrition',
  'Baby Care',
  'Beverages',
  'Personal Care',
  'Menstrual Hygiene',
  'B2B SaaS / Software',
  'E-commerce / Retail',
  'Healthcare / Pharma',
  'Real Estate',
  'Education / EdTech',
  'Other',
];

/**
 * Strip HTML tags, scripts, styles to clean plain text.
 * Limit to first 3000 chars to keep LLM prompt cost low.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')   // decode basic HTML entities roughly
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);
}

/**
 * Attempt to fetch website HTML with a hard timeout.
 * Tries https first, then http.
 * @param {string} domain
 * @returns {{ html: string|null, resolvedUrl: string|null }}
 */
async function fetchWebsiteHtml(domain) {
  const urls = [`https://${domain}`, `http://${domain}`];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000); // 7-second timeout

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIMEnrichBot/1.0; +https://aimnow.in)',
          'Accept': 'text/html,application/xhtml+xml,*/*',
        },
        redirect: 'follow',
      });

      clearTimeout(timer);

      if (res.ok) {
        const html = await res.text();
        return { html, resolvedUrl: url };
      }
    } catch (_e) {
      // Try next URL silently
    }
  }

  return { html: null, resolvedUrl: null };
}

/**
 * Enrich a corporate domain by fetching its website and using LLM to extract
 * key business details.
 *
 * @param {string} domain  e.g. "aimnow.in"
 * @returns {Promise<{
 *   business_name: string|null,
 *   industry: string|null,
 *   services: string|null,
 *   location: string|null,
 *   website_url: string|null,
 *   confidence: 'high'|'medium'|'low',
 *   source: 'scraped'|'llm_knowledge'|'unavailable'
 * }>}
 */
export async function enrichDomain(domain) {
  const defaultResult = {
    business_name: null,
    industry: null,
    services: null,
    location: null,
    website_url: null,
    confidence: 'low',
    source: 'unavailable',
  };

  if (!domain) return defaultResult;

  // ── Step 1: Fetch the website ──────────────────────────────────────────────
  const { html, resolvedUrl } = await fetchWebsiteHtml(domain);
  let contextBlock;
  let source = 'unavailable';

  if (html) {
    const plainText = stripHtml(html);
    contextBlock = `Domain: ${domain}\nWebsite URL: ${resolvedUrl}\n\nWebsite Content (first 3000 chars):\n${plainText}`;
    source = 'scraped';
    console.log(`[DomainEnrichment] Successfully scraped ${resolvedUrl} (${plainText.length} chars)`);
  } else {
    // Fallback: ask LLM based on world knowledge only
    contextBlock = `Domain: ${domain}\nWebsite: Not accessible (timed out or returned an error).\nUse your general world knowledge about this domain ONLY if you are highly confident it is a well-known brand. Otherwise return null for all fields.`;
    source = 'llm_knowledge';
    console.warn(`[DomainEnrichment] Could not fetch ${domain} website. Falling back to LLM world knowledge.`);
  }

  // ── Step 2: LLM Extraction ─────────────────────────────────────────────────
  const systemPrompt = `You are a business intelligence extraction AI.
Given a domain and its website content, extract key business details.

Return a valid JSON object with EXACTLY these keys:
- "business_name": The official company or brand name (string or null)
- "industry": Primary industry. Map STRICTLY to one of: ${VALID_INDUSTRIES.join(', ')}. Use "Other" if none match. (string or null)
- "services": Short comma-separated list of key services or products offered (string or null, max 80 chars)
- "location": Primary city and country if visible (e.g. "Mumbai, India"). null if not mentioned.
- "confidence": "high" if you are very confident in the extracted data, "medium" if somewhat confident, "low" if guessing.

Rules:
- Do NOT hallucinate. Return null for any field you cannot determine with reasonable confidence.
- Keep "services" concise — it's a category description, not a full list.
- Only extract from the provided content. Do not invent values.`;

  try {
    const resp = await callLLM(systemPrompt, contextBlock, true);
    const json = JSON.parse(resp);

    return {
      business_name: json.business_name || null,
      industry:      json.industry      || null,
      services:      json.services      || null,
      location:      json.location      || null,
      website_url:   resolvedUrl        || null,
      confidence:    json.confidence    || 'low',
      source,
    };
  } catch (e) {
    console.warn('[DomainEnrichment] LLM extraction failed:', e.message);
    return { ...defaultResult, source };
  }
}
