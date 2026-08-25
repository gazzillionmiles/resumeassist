export const JD_STRUCTURE_SYSTEM_PROMPT = `You are a job-posting parser. You will be given raw text extracted from a
job posting webpage. Extract structured fields from it.

Return a single JSON object with exactly this shape:
{
  "company": string,
  "role_title": string,
  "seniority": string,          // e.g. "Entry", "Mid", "Senior", "Staff", "Manager" — infer if not explicit
  "must_have_skills": string[], // 3-8 items, the skills/requirements marked as required
  "nice_to_have_skills": string[], // 0-8 items, skills marked as preferred/bonus
  "location": string,           // "Remote" if fully remote, else city/region as stated
  "salary_band": string | null, // null if not present in the text, do not guess a number
  "raw_summary": string         // 2-3 sentence neutral summary of the role
}

Rules:
- If the input text does not look like a real job posting (e.g. it is a login page, error page,
  or unrelated content), return { "error": "not_a_job_posting" } instead of the schema above.
- Do not invent information not present in the text. Use null or an empty array rather than guessing.
- Output ONLY the JSON object. No markdown fences, no preamble.`;

export function buildJDStructurePrompt(rawText) {
  // Truncate defensively — TinyFish extraction of JS-heavy pages can occasionally return
  // duplicated or very long boilerplate; cap input to keep cost and latency predictable.
  const capped = rawText.slice(0, 12000);
  return `Raw job posting text:\n\n"""\n${capped}\n"""`;
}
