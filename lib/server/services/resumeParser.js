import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { callBedrockJSON } from './bedrock.js';

const RESUME_STRUCTURE_SYSTEM_PROMPT = `You turn raw resume text into structured JSON. Return exactly:
{
  "name": string | null,
  "title": string | null,
  "skills": string[],
  "experience": [{ "company": string, "title": string, "duration": string, "bullets": string[] }],
  "education": [{ "institution": string, "degree": string, "year": string | null }]
}
Do not invent information not present in the text. Output ONLY the JSON object.`;

async function extractRawText(fileBuffer, mimeType = '', filename = '') {
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (filename || '').toLowerCase();

  const isPdf =
    lowerMime.includes('pdf') ||
    lowerName.endsWith('.pdf') ||
    (fileBuffer.length >= 4 && fileBuffer.toString('ascii', 0, 4) === '%PDF');

  const isDocx =
    lowerMime.includes('word') ||
    lowerMime.includes('officedocument') ||
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc');

  if (isPdf) {
    const parsed = await pdfParse(fileBuffer);
    return parsed.text || '';
  }

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value || '';
  }

  // Fallback heuristic: try PDF parse then DOCX
  try {
    const parsed = await pdfParse(fileBuffer);
    if (parsed.text && parsed.text.trim()) return parsed.text;
  } catch {
    // continue to mammoth fallback
  }

  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    if (result.value && result.value.trim()) return result.value;
  } catch {
    // throw unsupported below
  }

  throw new Error(`Unsupported resume file type: ${mimeType || filename || 'unknown'}`);
}

/**
 * Extracts raw text, then structures it.
 * Confidence is a heuristic flagging resumes worth manual review before first generation.
 */
export async function parseResume(fileBuffer, mimeType = '', filename = '') {
  const rawText = (await extractRawText(fileBuffer, mimeType, filename)).trim();

  if (rawText.length < 200) {
    return {
      rawText,
      structured: { name: null, title: null, skills: [], experience: [], education: [] },
      confidence: 'low',
    };
  }

  const structured = await callBedrockJSON(
    RESUME_STRUCTURE_SYSTEM_PROMPT,
    `Resume text:\n"""\n${rawText.slice(0, 15000)}\n"""`
  );

  const confidence =
    structured.skills?.length >= 3 && structured.experience?.length >= 1 ? 'high' : 'low';

  return { rawText, structured, confidence };
}
