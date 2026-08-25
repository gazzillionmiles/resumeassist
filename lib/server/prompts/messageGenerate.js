const TONE_GUIDANCE = {
  formal: 'Formal and professional. No contractions, no casual phrasing.',
  warm_professional: 'Warm and professional — personable but still polished, like a well-regarded colleague reaching out.',
  direct_concise: 'Direct and concise. Short sentences, no filler, get to the point in the first line.',
  enthusiastic: 'Enthusiastic and energetic, but not over-the-top — genuine interest, not hype.',
};

export const MESSAGE_GENERATE_SYSTEM_PROMPT = `You write cold outreach messages for job seekers reaching out about a specific
role. You will be given: a structured job description, the candidate's profile, optionally
company research analysis (recent developments, conversation hook, candidate connection),
a few of the candidate's own past messages as style examples, and a requested tone.

Hard requirements:
- If company research is provided, utilize the conversation hook or recent company developments
  to create an authentic, highly tailored opening and tie-in.
- If style examples are provided, match their opener style and general structure — sentence
  length, how they introduce themselves, how formal the greeting is. Do not just copy phrases;
  match the pattern.
- Reference 1-2 SPECIFIC must-have skills from the JD and tie them to something concrete in the
  candidate's actual experience. Never use generic flattery ("I'm excited about your innovative
  company") without a concrete tie-in.
- Email body: under 150 words, excluding subject line and signature.
- LinkedIn message: under 300 characters total (LinkedIn connection-note limits are tight —
  verify the current cap before shipping, it has changed before).
- Do not fabricate experience, dates, or skills not present in the candidate profile.
- Do not include placeholder brackets like [Company Name] — use the real values provided.

Return a single JSON object with exactly this shape:
{
  "email_subject": string,
  "email_body": string,
  "linkedin_message": string
}
Output ONLY the JSON object. No markdown fences, no preamble.`;

export function buildMessageGeneratePrompt({ jdStructured, profile, playbookExamples, tone, companyResearch }) {
  const toneLine = TONE_GUIDANCE[tone] || TONE_GUIDANCE.warm_professional;

  const playbookBlock = playbookExamples?.length
    ? `Candidate's own past messages (match this style):\n${playbookExamples
        .map((ex, i) => `Example ${i + 1}:\n"""\n${ex}\n"""`)
        .join('\n\n')}`
    : `No style examples provided — use the tone guidance only.`;

  const researchBlock = companyResearch
    ? `Company Research & Intel (use this to ground the outreach):\n${JSON.stringify(companyResearch, null, 2)}`
    : `No external company research provided.`;

  return `Requested tone: ${tone}\nTone guidance: ${toneLine}

Job description (structured):
${JSON.stringify(jdStructured, null, 2)}

Candidate profile:
${JSON.stringify(profile, null, 2)}

${researchBlock}

${playbookBlock}`;
}
