import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { extractText, chunkDocument } from './chunker.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';
import 'dotenv/config';
import { DiscoveryEngine } from './src/engines/discoveryEngine.js';
import { initSocketService, broadcastChatUpdate } from './src/services/socketService.js';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Database Pool
const pool = new Pool({
  connectionString: 'postgresql://admin:Z3a!Play%402026%23Secure@161.97.147.179:5432/preaimnowtable',
  ssl: false
});

// Setup engines
const discoveryEngine = new DiscoveryEngine(pool);

// Simple Login Logic
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ ok: true, token: 'fake-jwt-token', user: { name: 'Admin' } });
  } else {
    res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }
});

// ── Health check ───────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ ok: true, time: result.rows[0].now });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Dashboard Stats ─────────────────────────────────────────
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [services, questions, leads, playbooks, rules, versions] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM services WHERE status='active'"),
      pool.query("SELECT COUNT(*) FROM discovery_questions WHERE status='active'"),
      pool.query("SELECT COUNT(*) FROM leads"),
      pool.query("SELECT COUNT(*) FROM industry_playbooks WHERE status='active'"),
      pool.query("SELECT COUNT(*) FROM scoring_rules WHERE active=true"),
      pool.query("SELECT version_tag, status FROM knowledge_versions ORDER BY created_at DESC LIMIT 1"),
    ]);
    res.json({
      activeServices: parseInt(services.rows[0].count),
      activeQuestions: parseInt(questions.rows[0].count),
      totalLeads: parseInt(leads.rows[0].count),
      activePlaybooks: parseInt(playbooks.rows[0].count),
      scoringRules: parseInt(rules.rows[0].count),
      currentVersion: versions.rows[0] || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Services ─────────────────────────────────────────────────
app.get('/api/services', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services ORDER BY service_type, service_name');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/services/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services WHERE id=$1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/services/:id', async (req, res) => {
  const b = req.body;
  try {
    await pool.query(
      `UPDATE services SET service_name=$1, status=$2, priority=$3, working_definition=$4, primary_owner=$5, supporting_owner=$6, best_fit_industries=$7, risk_flags=$8, primary_objectives=$9, strong_fit_signals=$10, misfit_signals=$11, updated_at=NOW() WHERE id=$12`,
      [b.service_name, b.status, b.priority, b.working_definition,
      b.primary_owner, b.supporting_owner,
      b.best_fit_industries, b.risk_flags, b.primary_objectives,
      b.strong_fit_signals, b.misfit_signals, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Discovery Questions ──────────────────────────────────────
app.get('/api/questions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM discovery_questions ORDER BY priority_order, question_code');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/questions/:id', async (req, res) => {
  const b = req.body;
  try {
    await pool.query(
      `UPDATE discovery_questions SET question_text=$1, question_type=$2, purpose=$3, ask_if=$4, skip_if=$5, priority_order=$6, status=$7, quote_critical=$8, feasibility_critical=$9, scoring_critical=$10, updated_at=NOW() WHERE id=$11`,
      [b.question_text, b.question_type, b.purpose,
      b.ask_if, b.skip_if, b.priority_order, b.status,
      b.quote_critical, b.feasibility_critical, b.scoring_critical, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/questions', async (req, res) => {
  const b = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO discovery_questions (question_code, question_text, question_type, purpose, ask_if, skip_if, priority_order, status, version_tag) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'v1.0.0') RETURNING *`,
      [b.question_code, b.question_text, b.question_type, b.purpose, b.ask_if, b.skip_if, b.priority_order || 99, b.status || 'active']
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/questions/:id', async (req, res) => {
  try {
    await pool.query("UPDATE discovery_questions SET status='archived' WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Scoring ──────────────────────────────────────────────────
app.get('/api/scoring/components', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scoring_components ORDER BY component_name');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/scoring/rules', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scoring_rules ORDER BY component_code, sort_order');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/scoring/rules/:id', async (req, res) => {
  const b = req.body;
  try {
    await pool.query(
      `UPDATE scoring_rules SET rule_label=$1, condition_text=$2, points=$3, is_deduction=$4, active=$5, updated_at=NOW() WHERE id=$6`,
      [b.rule_label, b.condition_text, b.points, b.is_deduction, b.active, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/scoring/bands', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM score_bands ORDER BY min_score DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/scoring/thresholds', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lead_priority_thresholds ORDER BY min_total_score DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/scoring/thresholds/:id', async (req, res) => {
  const b = req.body;
  try {
    await pool.query(
      `UPDATE lead_priority_thresholds SET min_total_score=$1, max_total_score=$2, routing_action=$3, sla_hours=$4, updated_at=NOW() WHERE id=$5`,
      [b.min_total_score, b.max_total_score, b.routing_action, b.sla_hours, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Industry Playbooks ───────────────────────────────────────
app.get('/api/playbooks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM industry_playbooks ORDER BY industry_name');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/playbooks/:id', async (req, res) => {
  const b = req.body;
  try {
    await pool.query(
      `UPDATE industry_playbooks SET default_recommendation_bias=$1, trust_sensitivity=$2, environment_sensitivity=$3, scale_vs_precision=$4, buyer_personas=$5, strongest_objectives=$6, weak_objectives=$7, key_risk_flags=$8, premium_fit_signals=$9, status=$10, updated_at=NOW() WHERE id=$11`,
      [b.default_recommendation_bias, b.trust_sensitivity, b.environment_sensitivity,
      b.scale_vs_precision, b.buyer_personas, b.strongest_objectives,
      b.weak_objectives, b.key_risk_flags, b.premium_fit_signals,
      b.status, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Service-Industry Rankings ────────────────────────────────
app.get('/api/rankings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM service_industry_rankings ORDER BY industry_code, tier');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/rankings/:id', async (req, res) => {
  const b = req.body;
  try {
    await pool.query(`UPDATE service_industry_rankings SET tier=$1, reason=$2, active=$3, updated_at=NOW() WHERE id=$4`,
      [b.tier, b.reason, b.active, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Escalation Rules ─────────────────────────────────────────
app.get('/api/escalation', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM escalation_rules ORDER BY rule_name');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/escalation/:id', async (req, res) => {
  const b = req.body;
  try {
    await pool.query(`UPDATE escalation_rules SET rule_name=$1, condition_description=$2, escalate_to=$3, active=$4, updated_at=NOW() WHERE id=$5`,
      [b.rule_name, b.condition_description, b.escalate_to, b.active, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Leads ─────────────────────────────────────────────────────
app.get('/api/leads', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Proposal Readiness Gates ─────────────────────────────────
app.get('/api/proposal-gates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proposal_readiness_gates ORDER BY min_confidence_score DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/proposal-gates/:id', async (req, res) => {
  const b = req.body;
  try {
    await pool.query(`UPDATE proposal_readiness_gates SET required_fields=$1, required_conditions=$2, min_confidence_score=$3, updated_at=NOW() WHERE id=$4`,
      [b.required_fields, b.required_conditions, b.min_confidence_score, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Objection Responses ──────────────────────────────────────
app.get('/api/objections', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM objection_responses ORDER BY objection_category, sort_order');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/objections/:id', async (req, res) => {
  const b = req.body;
  try {
    await pool.query(`UPDATE objection_responses SET objection_text=$1, recommended_response=$2, active=$3, updated_at=NOW() WHERE id=$4`,
      [b.objection_text, b.recommended_response, b.active, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Feasibility Rules ────────────────────────────────────────
app.get('/api/feasibility', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM feasibility_rules ORDER BY service_code, sort_order');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Knowledge Versions ───────────────────────────────────────
app.get('/api/versions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM knowledge_versions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/versions/publish', async (req, res) => {
  const { version_tag } = req.body;
  try {
    await pool.query("UPDATE knowledge_versions SET status='archived' WHERE status='live'");
    await pool.query("UPDATE knowledge_versions SET status='live', published_at=NOW() WHERE version_tag=$1", [version_tag]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Overrides / Audit Log ────────────────────────────────────
app.get('/api/overrides', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM overrides ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Chunk Creation / Document Chunker ────────────────────────
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/chunker', upload.array('docs'), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const allQdrant = [];
    const allPostgres = [];
    let idCounter = 1;

    for (const file of files) {
      const rawText = await extractText(file.buffer, file.originalname);
      const { qdrantChunks, postgresChunks } = chunkDocument(rawText, file.originalname);

      qdrantChunks.forEach(c => {
        allQdrant.push({ id: `chunk_${idCounter++}`, ...c });
      });

      postgresChunks.forEach(c => {
        allPostgres.push({ id: `pg_${idCounter++}`, ...c });
      });
    }

    res.json({
      qdrant_chunks: allQdrant,
      postgres_seed: allPostgres,
      summary: {
        filesProcessed: files.length,
        qdrantCount: allQdrant.length,
        postgresCount: allPostgres.length
      }
    });
  } catch (e) {
    console.error('Chunker Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Case Studies ─────────────────────────────────────────────
app.get('/api/case-studies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM case_studies ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/case-studies/:id', async (req, res) => {
  const b = req.body;
  try {
    await pool.query(`UPDATE case_studies SET title=$1, status=$2, industry_tags=$3, service_tags=$4, updated_at=NOW() WHERE id=$5`,
      [b.title, b.status, b.industry_tags, b.service_tags, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CRM Field Definitions ────────────────────────────────────
app.get('/api/crm-fields', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM crm_field_definitions ORDER BY field_group, sort_order');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Qdrant & Embedding Logic ─────────────────────────────────
const QDRANT_URL = process.env.QDRANT_URL || "http://161.97.147.179:6333";
const COLLECTION_NAME = process.env.COLLECTION_NAME || "aim_brain_v2";
const EMBEDDING_MODEL = "Xenova/all-mpnet-base-v2";
const EMBEDDING_DIM = 768;

const qdrant = new QdrantClient({ url: QDRANT_URL });
let embedder = null;

async function initEmbedder() {
  if (embedder) return;
  console.log("📦 Loading embedding model …");
  embedder = await pipeline("feature-extraction", EMBEDDING_MODEL);
  console.log("✅ Embedding model ready");
}

async function embed(text) {
  if (!embedder) await initEmbedder();
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

async function ensureCollection() {
  try {
    const { collections } = await qdrant.getCollections();
    const exists = collections.some(c => c.name === COLLECTION_NAME);
    if (!exists) {
      console.log(`📝 Creating collection: ${COLLECTION_NAME}`);
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
      });
      await qdrant.createPayloadIndex(COLLECTION_NAME, { field_name: "section", field_schema: "keyword" });
      await qdrant.createPayloadIndex(COLLECTION_NAME, { field_name: "source", field_schema: "keyword" });
    }
  } catch (e) {
    console.error("Qdrant Error (ensureCollection):", e);
  }
}

app.post('/api/qdrant/ingest', async (req, res) => {
  const { chunks } = req.body;
  if (!Array.isArray(chunks)) return res.status(400).json({ error: "Chunks array required" });

  try {
    await initEmbedder();
    await ensureCollection();

    const BATCH = 20;
    const points = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const content = c.text || "";
      if (!content) continue;

      const vector = await embed(content);
      
      points.push({
        id: c.id || Math.random().toString(36).substr(2, 9),
        vector,
        payload: {
          content,
          section: c.section || "general",
          heading: c.heading || "",
          type: c.type || "insight",
          source: c.source || "",
          version: c.version || "v2.0",
        }
      });

      if (points.length >= BATCH) {
        await qdrant.upsert(COLLECTION_NAME, { points: points });
        points.length = 0;
      }
    }

    if (points.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, { points: points });
    }

    res.json({ ok: true, count: chunks.length });
  } catch (e) {
    console.error("Ingestion Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/qdrant/search', async (req, res) => {
  const { query, limit = 5 } = req.body;
  if (!query) return res.status(400).json({ error: "Query required" });

  try {
    await initEmbedder();
    const vector = await embed(query);
    
    const results = await qdrant.search(COLLECTION_NAME, {
      vector: vector,
      limit,
      with_payload: true,
      score_threshold: 0.35,
    });

    res.json({ results });
  } catch (e) {
    console.error("Search Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/qdrant/health', async (req, res) => {
  try {
    const info = await qdrant.getCollection(COLLECTION_NAME);
    res.json({ ok: true, status: 'connected', points: info.points_count });
  } catch (e) {
    res.json({ ok: false, status: 'disconnected', error: 'Could not reach Qdrant' });
  }
});

// ── Chatbot Endpoints ────────────────────────────────────────

app.post('/api/chatbot/public/message', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  try {
    let actualSessionId = sessionId;
    let leadId = null;

    if (!actualSessionId) {
      // First ever time seeing this user! Send welcome message and ask for email
      const leadCode = 'LD-' + Math.floor(Math.random() * 1000000);
      const newLead = await pool.query(
        "INSERT INTO leads (lead_code, source_channel, lead_origin_type) VALUES ($1, 'website', 'inbound') RETURNING id",
        [leadCode]
      );
      leadId = newLead.rows[0].id;

      const sessionCode = 'DS-' + Math.floor(Math.random() * 10000);
      const newSession = await pool.query(
        "INSERT INTO discovery_sessions (session_code, lead_id, channel) VALUES ($1, $2, 'chatbot') RETURNING id",
        [sessionCode, leadId]
      );
      actualSessionId = newSession.rows[0].id;
      
      broadcastChatUpdate(actualSessionId, { message, source: 'user', timestamp: new Date() });

      return res.json({ 
        nextQuestion: "Hi there! To get started, please provide your domain email address:",
        sessionId: actualSessionId 
      });
    }

    // We have a session, lookup lead
    const sessionRes = await pool.query("SELECT lead_id FROM discovery_sessions WHERE id=$1", [actualSessionId]);
    if (sessionRes.rows.length === 0) return res.status(404).json({error: "Session not found"});
    leadId = sessionRes.rows[0].lead_id;

    let leadRes = await pool.query("SELECT * FROM leads WHERE id=$1", [leadId]);
    let lead = leadRes.rows[0];

    broadcastChatUpdate(actualSessionId, { message, source: 'user', timestamp: new Date() });

    // If no email, treat this message as the email
    if (!lead.email) {
      if (message.includes('@')) {
        const domain = message.split('@')[1].toLowerCase().trim();
        const freeTiers = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
        
        if (freeTiers.includes(domain)) {
          const fallback = "We require a corporate or business domain email to proceed. Please provide your business email:";
          broadcastChatUpdate(actualSessionId, { message: fallback, source: 'ai', timestamp: new Date() });
          return res.json({ nextQuestion: fallback, sessionId: actualSessionId });
        }

        const emailInput = message.trim();
        let targetLeadId = leadId;

        // **NEW: Deduplicate Returning Users**
        const existingLeadRes = await pool.query("SELECT * FROM leads WHERE email=$1", [emailInput]);

        if (existingLeadRes.rows.length > 0) {
            targetLeadId = existingLeadRes.rows[0].id;
            
            // Re-route session to the historical lead
            await pool.query("UPDATE discovery_sessions SET lead_id=$1 WHERE id=$2", [targetLeadId, actualSessionId]);
            
            // Delete the blank lead shell we just created
            await pool.query("DELETE FROM leads WHERE id=$1", [leadId]);
            console.log(`[Chatbot] Returning user recognized: ${emailInput}. Routing to ${targetLeadId}`);
        } else {
            // New user, finalize the newly created shell
            await pool.query("UPDATE leads SET email=$1 WHERE id=$2", [emailInput, targetLeadId]);
        }
        
        // NEW: Full domain enrichment (fetch website HTML → LLM extraction → confirmation card)
        // Falls back gracefully to question flow if the domain cannot be scraped.
        const nextQ = await discoveryEngine.handleDomainEnrichment(targetLeadId, actualSessionId, emailInput);
        if (nextQ) broadcastChatUpdate(actualSessionId, { message: nextQ.question_text, source: 'ai', timestamp: new Date() });
        
        return res.json({ nextQuestion: nextQ, leadId: targetLeadId, sessionId: actualSessionId });
      } else {
        const fallback = "Please provide a valid email address containing an @ symbol.";
        broadcastChatUpdate(actualSessionId, { message: fallback, source: 'ai', timestamp: new Date() });
        return res.json({ nextQuestion: fallback, sessionId: actualSessionId });
      }
    }

    // Normal flow
    const nextQ = await discoveryEngine.handleIncomingMessage(leadId, actualSessionId, message);

    if (nextQ) {
      broadcastChatUpdate(actualSessionId, { message: nextQ.question_text, source: 'ai', timestamp: new Date() });
    }

    res.json({ nextQuestion: nextQ, leadId, sessionId: actualSessionId });
  } catch (e) {
    console.error("Chatbot Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chatbot/internal/message', async (req, res) => {
  // Similar logic but bypasses actual CRM writes, used for admin training
  res.json({ nextQuestion: null, notice: "Internal bot endpoint stub" });
});

// ── LLM Completion (Azure OpenAI) ───────────────────────────
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "https://chatgpt-vm.openai.azure.com/openai/deployments/gpt-5-model/chat/completions?api-version=2025-01-01-preview";
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;

app.post('/api/llm/complete', async (req, res) => {
  const { prompt, systemInstruction } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  if (!AZURE_OPENAI_KEY) {
    return res.status(500).json({ error: "AZURE_OPENAI_KEY not configured" });
  }

  try {
    const messages = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_KEY,
      },
      body: JSON.stringify({
        messages,
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    res.json({ content });
  } catch (e) {
    console.error("LLM Error:", e);
    res.status(500).json({ error: e.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Process.cwd() is /app/applet
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Use HTTP server for socket.io binding
  const server = http.createServer(app);
  initSocketService(server);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
