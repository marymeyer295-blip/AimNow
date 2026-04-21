import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import path from 'path';

// ─── CONFIG ────────────────────────────────────────────────────────────────

const VERSION = "v2.0";

const MIN_CHUNK_CHARS = 150;
const MAX_CHUNK_CHARS = 800;

// ─── POSTGRES PATTERNS ─────────────────────────────────────────────────────

const PG_PATTERNS = [
  /\b(fit score|authority score|urgency score|budget score|completeness score|strategic value score|feasibility score)\b.*\b(max|points|weight|zero to|out of)\b/i,
  /score.*\b(0|zero)\s*to\s*\d+/i,
  /\b(high[- ]priority|qualified[- ]priority|nurture|disqualify)\b.*\b(band|score|threshold|eighty|sixty|forty|twenty)\b/i,
  /\b(field name|field type|source|required|enum|multi.?select|boolean|integer|datetime|string)\b.*\b(crm|field|mapping)\b/i,
  /mandatory (quote|feasibility) inputs?:/i,
  /internal service code\s*[:|]/i,
  /service code\s*[:|]/i,
  /status\s*[:|]\s*(draft|active|archived|pilot)/i,
  /^\|\s*(must ask|quote critical|feasibility critical|scoring critical|optional depth)\s*\|/i,
  /\bmap(s|ped)? to\s+[a-z_]+\b/i,
  /logic version|model version|version v\d/i,
  /sla priority\s*[:|]/i,
  /escalation (flag|threshold|trigger)\s*[:|]/i,
  /routing rule/i,
  /^(service name|parent service|service type|service category|pilot scope|priority|primary owner|supporting owner|ops validation required|version)\s*[:|]/i,
];

const SECTION_MAP = [
  [/fit and misfit/i, "fit_logic"],
  [/misfit/i, "fit_logic"],
  [/objection/i, "objections"],
  [/pitch.?angle|recomm.*output|recommendation.*style/i, "pitch_angle"],
  [/discovery question|question bank|question matrix/i, "discovery"],
  [/execution model/i, "execution"],
  [/audience/i, "audience"],
  [/risk flag/i, "risk"],
  [/case study/i, "case_study"],
  [/scenario/i, "scenario"],
  [/industry/i, "industry"],
  [/service definition|working definition/i, "service_definition"],
  [/feasibility/i, "feasibility"],
  [/budget|pricing driver/i, "budget"],
  [/scoring cue/i, "scoring"],
  [/decision tree/i, "decision_tree"],
  [/playbook/i, "playbook"],
];

function detectSection(heading, fallback) {
  if (!heading) return fallback || "general";
  for (const [re, label] of SECTION_MAP) {
    if (re.test(heading)) return label;
  }
  return fallback || "general";
}

function detectType(text) {
  if (/^scenario\s+\d|scenario.*brief/i.test(text)) return "scenario";
  if (/\bexample\b.*[:"]/i.test(text)) return "example";
  if (/^(if|when)\b/i.test(text)) return "rule";
  if (/\b(should not|should avoid|never|must not)\b/i.test(text)) return "guardrail";
  if (/\b(objection|pushback|client says)\b/i.test(text)) return "objection";
  if (/\b(recommended|suggest|pitch)\b/i.test(text)) return "insight";
  if (/\?/.test(text)) return "question";
  return "insight";
}

function isNoise(text) {
  if (text.length < MIN_CHUNK_CHARS) return true;

  const noise = [
    /^(table of contents|document purpose|introduction|overview|appendix)\b/i,
    /^(this document|this pack|this record)\b/i,
    /^recommended next (document|pack|artifact)\b/i,
    /^(publication readiness checklist|validation checklist)\b/i,
    /^\d+\.\s*(document purpose|introduction|overview)\b/i,
    /^(page \d+|version \d|draft for validation)\s*$/i,
    /^\d+\s*$/i,
  ];
  return noise.some(re => re.test(text.trim()));
}

function classify(text) {
  const matches = PG_PATTERNS.filter(re => re.test(text));
  if (matches.length >= 2) return "POSTGRES";
  if (matches.length === 1 && text.length > 220 && /[.!?].*[.!?]/.test(text)) return "QDRANT";
  if (matches.length === 1) return "POSTGRES";
  return "QDRANT";
}

export async function extractText(buffer, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else if (ext === '.pdf') {
    const data = await pdf(buffer);
    return data.text;
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    let fullText = '';
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      fullText += xlsx.utils.sheet_to_txt(sheet) + '\n';
    });
    return fullText;
  } else {
    return buffer.toString('utf-8');
  }
}

export function chunkDocument(rawText, fileName) {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

  const blocks = [];
  let current = { heading: null, paragraphs: [] };

  const isHeading = (line) =>
    /^\d+(\.\d+)*\.\s+[A-Z]/.test(line) ||
    /^[A-Z][A-Z\s\/\-]{6,60}$/.test(line) ||
    (/^[A-Z][^.]{5,80}$/.test(line) && line.length < 80 && !line.endsWith("."));

  for (const line of lines) {
    if (isHeading(line)) {
      if (current.paragraphs.length > 0) blocks.push(current);
      current = { heading: line, paragraphs: [] };
    } else {
      current.paragraphs.push(line);
    }
  }
  if (current.paragraphs.length > 0) blocks.push(current);

  const qdrantChunks = [];
  const postgresChunks = [];

  for (const block of blocks) {
    const sectionLabel = detectSection(block.heading);
    const text = block.paragraphs.join(" ").trim();

    if (!text || isNoise(text)) continue;

    const sentences = text
      .replace(/([.?!])\s+/g, "$1\n")
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 20);

    let buffer = "";
    const flush = () => {
      const chunk = buffer.trim();
      if (!chunk || chunk.length < MIN_CHUNK_CHARS) return;
      const dest = classify(chunk);
      const obj = {
        text: chunk,
        section: sectionLabel,
        heading: block.heading || "",
        type: detectType(chunk),
        source: fileName,
        version: VERSION,
      };
      if (dest === "QDRANT") qdrantChunks.push(obj);
      else postgresChunks.push(obj);
      buffer = "";
    };

    for (const sentence of sentences) {
      if ((buffer + " " + sentence).length > MAX_CHUNK_CHARS) {
        flush();
      }
      buffer += (buffer ? " " : "") + sentence;
    }
    flush();
  }

  return { qdrantChunks, postgresChunks };
}
