import { sendWebhook } from '../services/webhookService.js';
import { callLLM } from '../services/llmService.js';
import { enrichDomain } from '../services/domainEnrichmentService.js';

/**
 * The Discovery Engine
 * Responsibilities:
 * 1. Fetch current lead state and missing fields.
 * 2. Parse incoming messages to infer fields using LLM.
 * 3. Update the lead and discovery_answers.
 * 4. Hit Webhooks when new data is captured.
 * 5. Determine the Next Best Question via priority logic and rewrite it naturally using LLM.
 *
 * NEW (Smart Onboarding flow):
 * 6. On first email → enrich domain via website fetch + LLM.
 * 7. Present a "Here's what I found" confirmation card.
 * 8. Only ask about fields that are still missing after confirmation.
 */

export class DiscoveryEngine {
  constructor(dbPool) {
    this.pool = dbPool;
  }

  // ── EXISTING: Identify industry directly from an email domain ───────────────
  // Kept for backwards compatibility — new flow uses handleDomainEnrichment().
  async inferIndustryFromDomain(leadId, email) {
    if (!email || !email.includes('@')) return null;
    const domain = email.split('@')[1];

    if (['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'].includes(domain.toLowerCase())) {
      return null;
    }

    const systemPrompt = `You are a B2B data enrichment AI. Given a corporate domain, identify the primary industry. 
    You MUST return a valid JSON object with a single key "industry". 
    Try to map it strictly to one of these categories: "FMCG / Snacks / Beverages", "Pet Care", "Beauty / Skincare", "Wellness / Nutrition", "Baby Care", "Beverages", "Personal Care", "Menstrual Hygiene".
    If the domain's industry is entirely unrelated (like B2B Software, SaaS, or Real Estate), return "Unknown".`;

    try {
      const resp = await callLLM(systemPrompt, `Domain: ${domain}`, true);
      const json = JSON.parse(resp);

      if (json.industry && json.industry !== 'Unknown') {
        const val = json.industry;

        await this.pool.query(
          `UPDATE leads SET industry_primary = $1 WHERE id=$2`,
          [val, leadId]
        ).catch(() => {});

        console.log(`[Discovery Engine] Inferred Industry -> ${val} based on domain ${domain}`);
        return val;
      }
    } catch (e) {
      console.warn("Failed to infer industry from domain:", e.message);
    }
    return null;
  }

  // ── EXISTING: Get conversation history to provide LLM context ───────────────
  async getChatHistory(sessionId) {
    const res = await this.pool.query(
      `SELECT answer_text, field_updated, field_status, created_at FROM discovery_answers 
       WHERE session_id = $1 ORDER BY created_at ASC LIMIT 10`,
      [sessionId]
    );
    return res.rows.map(r => `User previously answered for [${r.field_updated}] (${r.field_status}): "${r.answer_text}"`).join('\n');
  }

  // ── EXISTING: Intelligent extraction of fields from the latest user message ──
  async handleIncomingMessage(leadId, sessionId, rawMessage) {
    try {
      // NEW: Route to confirmation handler if the last system message was a confirmation card
      const sessionState = await this.getSessionState(sessionId);
      if (sessionState === 'awaiting_confirmation') {
        console.log('[Discovery Engine] Session awaiting confirmation — routing to summary confirmation handler.');
        return await this.handleSummaryConfirmation(leadId, sessionId, rawMessage);
      }

      const history = await this.getChatHistory(sessionId);

      // Fetch lead to know current state BEFORE LLM extraction
      const leadRes = await this.pool.query('SELECT * FROM leads WHERE id=$1', [leadId]);
      const lead = leadRes.rows[0];

      // ── Extended to include enrichment fields so the LLM can extract them too
      const STATUS_COLUMN_MAP = {
        'campaign_objective_primary': 'campaign_objective_primary_status',
        'service_category': null,
        'target_audience_summary': 'target_audience_summary_status',
        'target_geography': 'target_geography_status',
        'sample_volume_estimate': 'sample_volume_status',
        'campaign_scale_band': null,
        'budget_band': 'budget_band_status',
        'company_name': null,
        'industry_primary': null,
      };

      // Figure out what fields are currently "inferred" so the LLM knows what to confirm
      const inferredFieldsList = Object.keys(STATUS_COLUMN_MAP)
        .filter(f => {
           const sc = STATUS_COLUMN_MAP[f];
           if (sc) return lead[sc] === 'inferred';
           return false;
        })
        .map(f => `- ${f}: "${lead[f]}" `)
        .join('\n');

      const systemPrompt = `You are the AIM Entity Brain. Your job is to extract business requirements from lead conversations.
      Extract ONLY the fields present in the user's latest message. 
      Return a valid JSON object where keys are the field names and values are objects containing:
      - "value": the extracted string value
      - "state": "confirmed" (if explicitly stated by user or if they confirm an inference) OR "inferred" (if guessed from soft context).

      CRITICAL CONFIRMATION RULE:
      If the user says "Yes", "Correct", or "That's right", they are confirming a previously inferred field!
      Currently, the following fields are "inferred" and awaiting confirmation:
      ${inferredFieldsList || "(None)"}
      
      If the user's message is confirming one of these inferred fields, you MUST extract that field name, set "value" to the existing value, and set "state" to "confirmed".

      Valid priority keys:
      - campaign_objective_primary
      - service_category
      - target_audience_summary
      - target_geography
      - sample_volume_estimate
      - campaign_scale_band
      - budget_band
      - company_name
      - industry_primary
      
      If a field is not mentioned or confirmed, omit it completely from the JSON. Be concise.`;

      const userPrompt = `History:\n${history}\n\nLatest Message: "${rawMessage}"`;
      
      console.log("[Discovery Engine] Calling LLM to extract meaning...");
      let extractedFields = {};

      try {
        const llmResponse = await callLLM(systemPrompt, userPrompt, true);
        extractedFields = JSON.parse(llmResponse);
        console.log("[Discovery Engine] Extracted Fields:", extractedFields);
      } catch (e) {
        console.warn("[Discovery Engine] LLM JSON Extraction failed or timed out. Yielding to standard flow.", e.message);
      }

      // We maintain a memory state to override the DB in case of soft failures
      let memoryState = {};

      // Loop through extracted fields and update DB
      for (const [field, data] of Object.entries(extractedFields)) {
        if (!data || !data.value) continue;
        
        let value = data.value;
        let state = data.state === 'confirmed' ? 'confirmed' : 'inferred';
        
        const statusColumnName = STATUS_COLUMN_MAP[field];

        // If field has NO dedicated DB schema status column, any non-null assignment forces lock explicitly
        if (statusColumnName === null) {
            state = 'confirmed';
        }

        let currentDbStatus = statusColumnName ? lead[statusColumnName] : (lead[field] ? 'confirmed' : 'missing');

        // 1. STATE OVERWRITE PROTECTION (FIELD LOCK)
        // Never overwrite a field that is already confirmed
        if (currentDbStatus === 'confirmed') {
           console.log(`[Discovery Engine] Skipping overwrite for ${field} - already confirmed (locked).`);
           continue; 
        }

        // TYPE NORMALIZATION: Range strings
        if (field === 'sample_volume_estimate' && typeof value === 'string') {
           const match = value.match(/(\d+).*?(\d+)/);
           if (match) {
              value = `${match[1]}-${match[2]}`;
           }
        }

        // Some Postgres columns are TEXT[] arrays. We must pass an array, not a string.
        const arrayFields = ['target_geography', 'target_audience_segments', 'assumptions', 'risk_flags', 'preferred_touchpoints'];
        let dbValue = value;
        if (arrayFields.includes(field) && !Array.isArray(value)) {
           dbValue = typeof value === 'string' ? value.split(',').map(s => s.trim()) : [value];
        } else if (!arrayFields.includes(field) && Array.isArray(value)) {
           dbValue = value.join(', ');
        }

        const logValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        // Populate specific reliable memory overlay (Memory > DB)
        memoryState[field] = dbValue;
        if (statusColumnName) memoryState[statusColumnName] = state;

        // Save answer exactly to discovery_answers with correct state
        await this.pool.query(
          `INSERT INTO discovery_answers (session_id, lead_id, answer_text, field_updated, field_value, field_status, answer_source)
           VALUES ($1, $2, $3, $4, $5, $6, 'ai_inferred')`,
          [sessionId, leadId, rawMessage, field, logValue, state]
        );

        // Update the master lead record safely based on schema
        const hasStatusCol = !!statusColumnName;
        const query = hasStatusCol 
           ? `UPDATE leads SET "${field}" = $1, "${statusColumnName}" = $2 WHERE id=$3`
           : `UPDATE leads SET "${field}" = $1 WHERE id=$2`;
           
        const queryArgs = hasStatusCol ? [dbValue, state, leadId] : [dbValue, leadId];

        // Soft DB execution to prevent hard throw breaking processing
        await this.pool.query(query, queryArgs)
          .catch(e => console.warn(`DB Warn: Could not update field ${field}: ${e.message}`));

        // Hit the n8n webhook asynchronously ONLY IF CHANGED (WEBHOOK DEDUP)
        const existingValue = lead[field];
        const dbValueString = Array.isArray(dbValue) ? dbValue.join(',') : String(dbValue);
        const existingValueString = Array.isArray(existingValue) ? existingValue.join(',') : String(existingValue || '');
        
        const valueChanged = dbValueString !== existingValueString;
        const stateChanged = currentDbStatus !== state;

        if (valueChanged || stateChanged) {
           sendWebhook({ event: 'field_updated', leadId, email: lead.email, field, value: logValue, state });
        }
      }

      // Re-evaluate what question to ask next, blending in confirmed memory overlays
      const nextQ = await this.getNextBestQuestion(leadId, sessionId, memoryState, rawMessage);
      return nextQ;

    } catch (e) {
      console.error('Failed to handle incoming message:', e);
      throw e; 
    }
  }

  // ── EXISTING: Identify next question to ask based on missing CRM facts ───────
  async getNextBestQuestion(leadId, sessionId, memoryState = {}, rawMessage = "") {
    try {
      const leadRes = await this.pool.query('SELECT * FROM leads WHERE id=$1', [leadId]);
      if (leadRes.rows.length === 0) return null;
      let lead = leadRes.rows[0];

      // APPLY MEMORY > DB STATE FIX
      lead = { ...lead, ...memoryState };

      // DOMAIN SAAS DETECTION RULES
      const isSaaS = 
          (lead.service_category && /(saas|software|b2b|platform)/i.test(lead.service_category)) ||
          (/(saas|software|b2b|platform)/i.test(rawMessage)) ||
          (lead.industry_primary && /(saas|software|b2b|platform)/i.test(lead.industry_primary));

      // STRICT NEXT QUESTION ORDERING
      // company_name and industry_primary are at the top so the failsafe path asks them first
      const PRIORITY_ORDER = [
        'company_name',
        'industry_primary',
        'campaign_objective_primary',
        'service_category',
        'target_audience_summary',
        'target_geography',
        'campaign_scale_band',
        'budget_band'
      ];

      // Exclude Product Sampling questions entirely if we determine it's B2B software
      if (!isSaaS) {
         PRIORITY_ORDER.splice(6, 0, 'sample_volume_estimate');
      }

      const STATUS_COLUMN_MAP = {
        'company_name': null,
        'industry_primary': null,
        'campaign_objective_primary': 'campaign_objective_primary_status',
        'service_category': null,
        'target_audience_summary': 'target_audience_summary_status',
        'target_geography': 'target_geography_status',
        'sample_volume_estimate': 'sample_volume_status',
        'campaign_scale_band': null,
        'budget_band': 'budget_band_status'
      };

      const fields = {};
      for (const f of PRIORITY_ORDER) {
         const sc = STATUS_COLUMN_MAP[f];
         let st = sc ? lead[sc] : null;
         
         if (!st) {
             if (sc === null) {
                 st = lead[f] ? 'confirmed' : 'missing';
             } else {
                 st = lead[f] ? 'inferred' : 'missing';
             }
         }
         fields[f] = { state: st, locked: st === 'confirmed' };
      }

      // Loop breaker DB check: explicitly fetch the last asked question field
      let lastAskedField = null;
      try {
          const lastQRes = await this.pool.query(
              `SELECT field_updated FROM discovery_answers 
               WHERE session_id = $1 AND answer_source = 'system' 
               AND field_updated NOT IN ('__confirmation_card__', 'email_captured')
               ORDER BY created_at DESC LIMIT 1`, 
              [sessionId]
          );
          if (lastQRes.rows.length > 0) {
              lastAskedField = lastQRes.rows[0].field_updated;
          }
      } catch (e) {
          console.warn("Loop breaker DB check failed", e.message);
      }

      let targetField = null;
      let targetState = null;

      for (const f of PRIORITY_ORDER) {
          if (!fields[f].locked) {
              // LOOP BREAKER: block re-ask if we are stuck on the same field
              if (f === lastAskedField) {
                  console.log(`[Discovery Engine] LOOP BREAKER: forceNextField() skipping ${f} as it was just asked.`);
                  continue;
              }
              targetField = f;
              targetState = fields[f].state;
              break;
          }
      }

      // Fallback if all remaining missing fields were blocked by the loop breaker
      if (!targetField) {
          targetField = PRIORITY_ORDER.find(f => !fields[f].locked);
          if (targetField) {
             targetState = fields[targetField].state;
          }
      }

      if (!targetField) {
        // Stop Condition Met — all required fields confirmed
        console.log("[Discovery Engine] All priority fields are confirmed. Stopping discovery.");
        await this.pool.query("UPDATE leads SET proposal_readiness_status = 'needs_human_review' WHERE id=$1", [leadId]);
        return {
          question_text: "Thank you for sharing your details! We have all the required information on file. How can I further assist you today?"
        };
      }

      // Fetch base question from DB to give LLM context
      let rawTargetQuestion = null;
      const qRes = await this.pool.query("SELECT * FROM discovery_questions WHERE field_to_populate = $1 LIMIT 1", [targetField]);
      if (qRes.rows.length > 0) {
        rawTargetQuestion = qRes.rows[0];
      } else {
        rawTargetQuestion = { field_to_populate: targetField, question_text: `Could you specify your ${targetField.replace(/_/g, ' ')}?` };
      }

      // Use LLM to rewrite the question naturally
      const history = await this.getChatHistory(sessionId);
      
      let promptBehavior = `Rewrite this into a single, natural, brief, conversational question. Do NOT ask multiple questions. Do NOT sound like a robot. Just ask the question directly.`;
      
      if (targetState === 'inferred') {
          promptBehavior = `The system has tentatively inferred a value for this field based on past context, but we need explicit confirmation. Ask a brief, natural yes/no clarifying question to confirm what we previously discussed, instead of asking a broad open-ended question.`;
      }

      const systemPrompt = `DISCOVERY QUESTION GENERATION RULES

You are not a chatbot. You are a structured discovery engine.

Rules:
1. NEVER ask about a field that is already confirmed
2. NEVER repeat a question about the same field
3. ALWAYS move to the next missing high-priority field
4. DO NOT ask for confirmation if the value is already clear
5. DO NOT rephrase the same question again
6. Ask only ONE question at a time
7. Prefer extracting information over asking
8. If a field is inferred with high confidence, treat it as confirmed
9. Always progress forward in discovery

You need the user to furnish data for their "${targetField}".
The baseline internal question is: "${rawTargetQuestion.question_text}".

${promptBehavior}

Bad behavior (strictly forbidden):
- "Just to confirm..." loops
- repeating same category question
- asking already answered fields

Good behavior:
- smooth progression
- intelligent assumption usage
- minimal but precise questioning`;

      const userPrompt = `Chat context:\n${history}\n\nRewrite the question:`;
      
      console.log(`[Discovery Engine] Rewriting question for field: ${rawTargetQuestion.field_to_populate} (State: ${targetState})`);
      
      try {
        const rewrittenTextRaw = await callLLM(systemPrompt, userPrompt, false);
        const rewrittenText = rewrittenTextRaw.replace(/^"|"$/g, '').trim();
        
        // Save the fact that AI asked this question to support loop breaking
        await this.pool.query(
           `INSERT INTO discovery_answers (session_id, lead_id, answer_text, field_updated, field_value, field_status, answer_source)
            VALUES ($1, $2, $3, $4, $5, $6, 'system')`,
           [sessionId, leadId, rewrittenText, targetField, 'N/A', 'missing']
        ).catch(e => console.warn("Failed to save system question:", e.message));

        return {
          ...rawTargetQuestion,
          question_text: rewrittenText
        };
      } catch (e) {
        console.warn("[Discovery Engine] LLM Question Formatting timed out. Falling back to DB string.", e.message);
        return rawTargetQuestion;
      }
      
    } catch (e) {
      console.error('Discovery Engine Error:', e);
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // NEW METHODS — Smart Onboarding Flow
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Derive whether this session is waiting for the user to confirm/correct
   * the enrichment card, or is in the normal question-collection flow.
   * Detection: last system message has field_updated = '__confirmation_card__'
   */
  async getSessionState(sessionId) {
    try {
      const res = await this.pool.query(
        `SELECT field_updated FROM discovery_answers
         WHERE session_id = $1 AND answer_source = 'system'
         ORDER BY created_at DESC LIMIT 1`,
        [sessionId]
      );
      if (res.rows.length > 0 && res.rows[0].field_updated === '__confirmation_card__') {
        return 'awaiting_confirmation';
      }
    } catch (e) {
      console.warn('[Discovery Engine] getSessionState failed:', e.message);
    }
    return 'collecting';
  }

  /**
   * Called instead of the old inferIndustryFromDomain + handleIncomingMessage("email provided").
   * 1. Checks if lead already has enrichment data (returning user → skip card).
   * 2. Fetches domain website HTML and uses LLM to extract business details.
   * 3. Writes enriched fields to DB (only if currently null).
   * 4. Returns a "Here's what I found" confirmation card, OR falls through
   *    directly to the next question if nothing was found.
   */
  async handleDomainEnrichment(leadId, sessionId, email) {
    const domain = email.split('@')[1];

    // Returning user check — if core enrichment fields already exist, skip the card
    const existingRes = await this.pool.query(
      'SELECT company_name, industry_primary FROM leads WHERE id=$1',
      [leadId]
    );
    const existing = existingRes.rows[0];
    if (existing && existing.company_name && existing.industry_primary) {
      console.log('[Discovery Engine] Lead already enriched — skipping domain card, going to question flow.');
      return await this.getNextBestQuestion(leadId, sessionId, {}, 'email provided');
    }

    // Run full domain enrichment (Option A: fetch HTML → LLM)
    let enriched = null;
    try {
      enriched = await enrichDomain(domain);
      console.log(`[Discovery Engine] Enrichment result for ${domain}:`, enriched);
    } catch (e) {
      console.warn('[Discovery Engine] enrichDomain threw unexpectedly:', e.message);
    }

    const prefilled = {};

    if (enriched) {
      const fieldMap = [
        { key: 'business_name', col: 'company_name',    daField: 'company_name',    isArray: false },
        { key: 'industry',      col: 'industry_primary', daField: 'industry_primary', isArray: false },
        { key: 'services',      col: 'service_category', daField: 'service_category', isArray: false },
        { key: 'location',      col: 'target_geography', daField: 'target_geography', isArray: true  },
      ];

      for (const { key, col, daField, isArray } of fieldMap) {
        const val = enriched[key];
        if (!val) continue;

        // Never overwrite an existing value
        const check = await this.pool.query(`SELECT "${col}" FROM leads WHERE id=$1`, [leadId]);
        const existingVal = check.rows[0]?.[col];
        const hasValue = Array.isArray(existingVal) ? existingVal.length > 0 : !!existingVal;
        if (hasValue) continue;

        const dbValue = isArray ? [val] : val;

        await this.pool.query(`UPDATE leads SET "${col}"=$1 WHERE id=$2`, [dbValue, leadId])
          .catch(err => console.warn(`[Discovery Engine] Enrichment write warn for ${col}:`, err.message));

        prefilled[daField] = val;

        // Log the enrichment event
        await this.pool.query(
          `INSERT INTO discovery_answers (session_id, lead_id, answer_text, field_updated, field_value, field_status, answer_source)
           VALUES ($1,$2,$3,$4,$5,$6,'ai_inferred')`,
          [sessionId, leadId, `Auto-enriched from domain: ${domain}`, daField, val, 'inferred']
        ).catch(err => console.warn('[Discovery Engine] discovery_answers insert warn:', err.message));
      }
    }

    const hasEnrichedData = Object.keys(prefilled).length > 0;
    const card = this.buildConfirmationCard(prefilled, domain);

    // Store the card as a system message.
    // If enriched data exists → use __confirmation_card__ so getSessionState() detects it.
    // If nothing found → use email_captured so next message goes to normal collection flow.
    const fieldMarker = hasEnrichedData ? '__confirmation_card__' : 'email_captured';

    await this.pool.query(
      `INSERT INTO discovery_answers (session_id, lead_id, answer_text, field_updated, field_value, field_status, answer_source)
       VALUES ($1,$2,$3,$4,$5,$6,'system')`,
      [sessionId, leadId, card, fieldMarker, JSON.stringify(prefilled), 'missing']
    ).catch(err => console.warn('[Discovery Engine] Failed to save domain card:', err.message));

    return {
      question_text: card,
      type: hasEnrichedData ? 'confirmation_card' : 'question',
      prefilled,
    };
  }

  /**
   * Build the "Here's what I found" card shown after domain enrichment.
   * If nothing was found, returns a polite failsafe message asking for details directly.
   */
  buildConfirmationCard(prefilled, domain) {
    const FIELD_LABELS = {
      company_name:     'Business Name',
      industry_primary: 'Industry',
      service_category: 'Services',
      target_geography: 'Location',
    };

    const ALL_ENRICHABLE = ['company_name', 'industry_primary', 'service_category', 'target_geography'];
    const hasAny = Object.keys(prefilled).length > 0;

    if (!hasAny) {
      return `Thanks! I wasn't able to automatically pull details for **${domain}**.\n\nCould you quickly share:\n- Business Name\n- Industry\n- Services you offer\n- Primary location`;
    }

    const lines = [`Here's what I found for **${domain}**. Please confirm or correct:\n`];

    for (const field of ALL_ENRICHABLE) {
      const label  = FIELD_LABELS[field];
      const value  = prefilled[field];
      const display = value ? (Array.isArray(value) ? value.join(', ') : value) : '*(please provide)*';
      lines.push(`- ${label}: ${display}`);
    }

    lines.push('\nReply **"Yes"** to confirm all, or correct any field above.');
    return lines.join('\n');
  }

  /**
   * Handles the user's reply to the confirmation card.
   * Parses confirm/correct intent via LLM, writes verified/corrected values to DB,
   * then hands off to getNextBestQuestion() for the remaining business questions.
   */
  async handleSummaryConfirmation(leadId, sessionId, rawMessage) {
    // Retrieve what was prefilled in the card
    const cardRes = await this.pool.query(
      `SELECT field_value FROM discovery_answers
       WHERE session_id=$1 AND field_updated='__confirmation_card__' AND answer_source='system'
       ORDER BY created_at DESC LIMIT 1`,
      [sessionId]
    );

    let prefilledFields = {};
    if (cardRes.rows.length > 0) {
      try { prefilledFields = JSON.parse(cardRes.rows[0].field_value); } catch (_) {}
    }

    const FIELD_LABELS = {
      company_name:     'Business Name',
      industry_primary: 'Industry',
      service_category: 'Services',
      target_geography: 'Location',
    };

    const prefilledSummary = Object.entries(prefilledFields)
      .map(([k, v]) => `- ${FIELD_LABELS[k] || k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n') || '(none)';

    const systemPrompt = `You are parsing a user's reply to a business data confirmation card.
The user was shown these prefilled business details:
${prefilledSummary}

Parse their reply and return VALID JSON with exactly these keys:
{
  "action": "confirmed" | "corrected" | "mixed",
  "corrections": {
    "company_name": "<corrected value or null>",
    "industry_primary": "<corrected value or null>",
    "service_category": "<corrected value or null>",
    "target_geography": "<corrected value or null>"
  },
  "confirmed_fields": ["<field_name>", ...]
}

Rules:
- "Yes", "Correct", "Looks good", "That's right" → action="confirmed", confirmed_fields = all shown field names, all corrections = null.
- If the user corrects a specific field, put the new value in corrections for that field key only.
- confirmed_fields = fields NOT corrected (implicitly accepted).
- Only include field names that were actually shown in the card (keys from the prefilled list).`;

    let parsed = {
      action: 'confirmed',
      corrections: {},
      confirmed_fields: Object.keys(prefilledFields),
    };

    try {
      const resp = await callLLM(systemPrompt, `User reply: "${rawMessage}"`, true);
      parsed = JSON.parse(resp);
      console.log('[Discovery Engine] Confirmation parsed:', parsed);
    } catch (e) {
      console.warn('[Discovery Engine] Confirmation parsing LLM failed — defaulting to full confirm:', e.message);
    }

    const ARRAY_FIELDS  = ['target_geography'];
    const ALL_ENRICHABLE = ['company_name', 'industry_primary', 'service_category', 'target_geography'];

    for (const field of ALL_ENRICHABLE) {
      const correction = parsed.corrections?.[field];
      const isConfirmed =
        parsed.action === 'confirmed' ||
        (Array.isArray(parsed.confirmed_fields) && parsed.confirmed_fields.includes(field));

      if (correction) {
        // User explicitly corrected this field → write new value
        const dbValue = ARRAY_FIELDS.includes(field) ? [correction] : correction;

        await this.pool.query(`UPDATE leads SET "${field}"=$1 WHERE id=$2`, [dbValue, leadId])
          .catch(e => console.warn(`[Discovery Engine] Correction update warn ${field}:`, e.message));

        await this.pool.query(
          `INSERT INTO discovery_answers (session_id, lead_id, answer_text, field_updated, field_value, field_status, answer_source)
           VALUES ($1,$2,$3,$4,$5,$6,'human_entered')`,
          [sessionId, leadId, rawMessage, field, correction, 'confirmed']
        ).catch(() => {});

        sendWebhook({ event: 'field_updated', leadId, field, value: correction, state: 'confirmed' });

      } else if (isConfirmed && prefilledFields[field]) {
        // User confirmed the prefilled value → log as human_entered / confirmed
        const logVal = Array.isArray(prefilledFields[field])
          ? prefilledFields[field].join(', ')
          : String(prefilledFields[field]);

        await this.pool.query(
          `INSERT INTO discovery_answers (session_id, lead_id, answer_text, field_updated, field_value, field_status, answer_source)
           VALUES ($1,$2,$3,$4,$5,$6,'human_entered')`,
          [sessionId, leadId, rawMessage, field, logVal, 'confirmed']
        ).catch(() => {});
      }
    }

    // Hand off to normal question flow for any remaining missing business fields
    const nextQ = await this.getNextBestQuestion(leadId, sessionId, {}, rawMessage);
    return nextQ;
  }
}
