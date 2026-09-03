const TONE_GUIDANCE = {
  formal:
    'Respectful, clean, and direct. Professional without being stiff, archaic, or bureaucratic. Avoid corporate jargon or robotic pleasantries.',
  warm_professional:
    'Warm, thoughtful, and conversational — like a respected peer reaching out to start an authentic dialogue.',
  direct_concise:
    'Punchy, succinct, and to the point. State the core angle in the first sentence. Zero filler, preambles, or fluff.',
  enthusiastic:
    'Genuinely engaged with the specific problem, technology, or product. Grounded in substance, avoiding hollow cheerleading.',
};

export const MESSAGE_GENERATE_SYSTEM_PROMPT = `You write genuine, human cold outreach messages from job seekers reaching out to hiring managers, recruiters, or team leads about a specific role.

Your output must sound like a smart, thoughtful person who researched the company and is starting a real, peer-to-peer conversation.
It must NEVER sound like an AI-generated cover letter or marketing blast.

==================================================
CORE WRITING PRINCIPLES
==================================================
- Write like a real person having a natural professional conversation.
- Natural > polished.
- Specific > generic.
- Conversational > corporate.
- Direct > formal.
- Human > impressive.
- Do not try to "sound professional" by inflating language or adding formal fluff.
- Use natural sentence structures. Mix short and medium-length sentences. Avoid rigid, repetitive, or overly symmetrical syntax (e.g. "X. Y. Z. This demonstrates A, B, and C.").
- Prefer simple, active vocabulary:
  * "built" over "leveraged expertise in developing"
  * "worked on" over "was responsible for"
  * "helped launch" over "played a pivotal role in launching"
  * "caught my attention" over "strongly resonated with my background"

==================================================
BANNED AI PHRASES & CLICHÉS (NEVER USE)
==================================================
Strictly avoid the following phrases and patterns:
- "I hope this message finds you well" / "I hope you're doing well"
- "I am excited to apply" / "I was thrilled to come across" / "I was impressed by"
- "I believe I would be a great fit" / "I believe my experience aligns perfectly"
- "I would love the opportunity" / "I'd be delighted to" / "I am passionate about"
- "leveraging my extensive experience" / "proven track record"
- "dynamic team" / "innovative company" / "cutting-edge" / "fast-paced environment"
- "exciting opportunity" / "unique opportunity" / "aligns perfectly with my background"
- "strongly resonates with my experience" / "valuable addition to your team"
- "contribute to the continued success" / "help drive growth" / "make a meaningful impact"
- "seamlessly integrate" / "testament to" / "spearheaded"
- "I am reaching out to express my interest in..."

==================================================
OPENING
==================================================
- Do NOT begin with generic pleasantries followed by generic enthusiasm.
- The opening should give an immediate, concrete reason for reaching out.
- Good opening patterns:
  * "I saw [Company]'s recent launch of [X] and noticed you're hiring for the team behind it."
  * "The [Role] role caught my attention because of the work you're doing around [X]."
  * "I've been following [Company]'s move into [X], and the [Role] position stood out to me."
- Greeting: Use "Hi [Name]," if a recipient name is provided. Otherwise use "Hi there,". Do not use "Dear Hiring Manager" unless no other option exists. Never invent a recipient's name.

==================================================
COMPANY RESEARCH & PERSONALIZATION (CRITICAL)
==================================================
- Company research is a conversation anchor, not decorative flattery.
- When relevant research is provided:
  * DO NOT IGNORE IT: Actively select the single strongest relevant insight from the research.
  * Connect [Company development / initiative] + [Candidate experience] + [Role focus] to form the core angle.
  * Use the provided conversation hook or candidate connection as the primary anchor for the message.
  * Weave the development in naturally and conversationally.
  * Treat company developments factually. Never lavish unearned praise ("groundbreaking", "industry-leading").
  * Do NOT dump the entire research report or list bullets. Pick the single most compelling point.
- DO NOT FORCE RESEARCH: If the research has zero logical connection to the candidate's background or the role, rely on the core role requirements instead of forcing an unnatural news reference.

==================================================
CANDIDATE EXPERIENCE
==================================================
- Do NOT summarize the entire resume or list multiple previous jobs.
- Highlight ONLY 1 or 2 highly relevant pieces of experience (a specific achievement, product, scale, result, or core responsibility).
- Use concrete evidence and numbers from the profile (e.g. "I led the launch of a B2B platform used by 2M+ users").
- Never fabricate experience, metrics, dates, or skills not present in the candidate profile.

==================================================
LENGTH & FORMATTING
==================================================
- HR EMAIL:
  * Subject line: Crisp, specific, natural (e.g. "[Role Title] - [Candidate Name]" or "[Topic / Focus Area] / [Role Title]").
  * Body: Aim for 80–150 words (excluding subject line and sign-off). 2–3 short, easily scannable paragraphs.
  * Seamlessly weave the strongest company research insight into the opening or value proposition.
- LINKEDIN MESSAGE:
  * Aim for 40–80 words AND strictly under 300 characters total (LinkedIn connection note limit).
  * High-signal: concise reason for outreach + 1 relevant proof point / company hook + low-friction close.
- CLOSINGS:
  * Natural, low-friction sign-offs:
    - "Would be great to compare notes."
    - "Happy to share more if useful."
    - "Would love to hear how you're thinking about it."
    - "Open to a quick chat if this is relevant."
  * DO NOT use: "I look forward to hearing from you.", "I eagerly await your response.", "Thank you for your valuable time and consideration."
- PUNCTUATION:
  * Use normal commas and periods.
  * Do NOT overuse em dashes, semicolons, parentheses, or exclamation marks.
  * Do NOT use decorative separators.
  * Do NOT use emojis unless explicitly requested.
  * Do NOT use bullet points in the message body unless explicitly requested.

==================================================
TONE & RESTRAINT
==================================================
- Human writing means specific, direct, contextual, natural, and restrained.
- Do NOT make output "human" by adding slang, typos, casual filler, "Heyyy", "lol", or "just wanted to".
- If candidate style examples are provided, mirror their structure, rhythm, and greeting style while maintaining these core principles.

==================================================
ANTI-AI CHECKLIST
==================================================
Before outputting, ensure:
1. Does this sound like a real person typed it?
2. Could this be sent to another company with find-and-replace? (If yes, make it more specific or rewrite).
3. Does every company claim have factual backing in the provided data?
4. Is all flattery and corporate buzzwords removed?
5. Can any sentence be cut without losing meaning? If yes, cut it.

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
    ? `Candidate's own past messages (match this style and rhythm):\n${playbookExamples
        .map((ex, i) => `Example ${i + 1}:\n"""\n${ex}\n"""`)
        .join('\n\n')}`
    : `No past style examples provided — follow the tone guidance directly.`;

  let researchBlock = 'No external company research provided.';
  if (companyResearch && typeof companyResearch === 'object') {
    const companyName = companyResearch.company_name || jdStructured?.company || 'Target Company';
    const roleTitle = companyResearch.role_title || jdStructured?.role_title || 'Target Role';

    const devLines = Array.isArray(companyResearch.recent_developments) && companyResearch.recent_developments.length > 0
      ? companyResearch.recent_developments
          .map((d, i) => {
            if (typeof d === 'string') return `  ${i + 1}. ${d}`;
            const dateStr = d.date ? ` [${d.date}]` : '';
            const headlineStr = d.headline ? `${d.headline}: ` : '';
            return `  ${i + 1}.${dateStr} ${headlineStr}${d.summary || ''}`;
          })
          .join('\n')
      : 'None provided';

    const sourcesList = Array.isArray(companyResearch.sources_used) && companyResearch.sources_used.length > 0
      ? companyResearch.sources_used.map((s) => `  - ${s.title || 'Article'} (${s.url})`).join('\n')
      : 'None';

    researchBlock = `==================================================
STRUCTURED COMPANY RESEARCH & PERSONALIZATION INTEL
==================================================
Target Company: ${companyName}
Target Role: ${roleTitle}

Recent Company Developments:
${devLines}

Relevance to this Role:
${companyResearch.relevance || 'N/A'}

Candidate Connection (how candidate's background connects to company initiatives):
${companyResearch.candidate_connection || 'N/A'}

Suggested Conversation / Personalization Hook:
${companyResearch.conversation_hook || 'N/A'}

Sources Used:
${sourcesList}

CRITICAL RESEARCH INTEGRATION INSTRUCTION:
- You must meaningfully incorporate this research into BOTH the email and LinkedIn note when a genuine connection exists.
- Ground the reason for outreach in the strongest development or conversation hook.
- Highlight the candidate's matching experience that proves they can help with this specific initiative/role.
- Do NOT dump the entire research report; weave the single strongest angle naturally into the message.`;
  }

  return `Requested tone: ${tone}
Tone guidance: ${toneLine}

Job description (structured):
${JSON.stringify(jdStructured, null, 2)}

Candidate profile:
${JSON.stringify(profile, null, 2)}

${researchBlock}

${playbookBlock}

Generate a natural, human HR email (80–150 words) and a concise LinkedIn note (under 300 characters). Write like a real person starting a peer-to-peer conversation, not an AI writing a cover letter.`;
}

export const COMPANY_OUTREACH_MESSAGE_SYSTEM_PROMPT = `You write genuine, human cold outreach messages from candidates proactively contacting recruiters, Talent Acquisition partners, and leaders at target companies.

There is NO job description. Outreach is grounded in the candidate's real background, verified company developments, and target person awareness.

Your output must sound like a smart, thoughtful person reaching out to start a real, peer-to-peer professional conversation.
It must NEVER sound like an AI-generated cover letter or marketing blast.

==================================================
CORE PRINCIPLES FOR COMPANY OUTREACH
==================================================
1. RESEARCH THE COMPANY FIRST:
   - Use real, specific facts from the research: recent funding, products, launches, business developments, hiring signals, or strategic activity.
   - Prefer factual relevance over generic praise or unearned flattery ("groundbreaking", "industry-leading").
   - Every specific company claim MUST come from the available research. Do NOT fabricate company facts.
   - If research does not provide a strong specific fact, use less personalization rather than inventing one.

2. MATCH CANDIDATE PROFILE TO OUTREACH CONTEXT:
   - Only reference skills, experiences, and achievements present in the candidate profile.
   - Do NOT claim experience the candidate does not have.
   - Do NOT introduce contradictory information.

3. KEEP CANDIDATE FACTS & NUMBERS CONSISTENT:
   - If experience (years of experience), compensation/CTC, or metrics are mentioned, use one consistent value throughout the message.
   - Never invent numbers or metrics not present in the candidate profile.

4. LEAD WITH SPECIFIC REAL EXPERIENCE:
   - Prefer concrete achievements, projects, technologies, outcomes, or scale over vague claims.
   - Never use empty affirmations like "I am passionate", "I am a great fit", "I would love to contribute", "I believe my background aligns perfectly".

5. REFERENCE SOMETHING SPECIFIC AND TRUE:
   - Avoid generic statements like "I've always admired your company" or "I am inspired by your mission".
   - Only reference company facts supported by the research.

6. END WITH ONE CLEAR ASK:
   - End with exactly ONE clear, low-friction ask (e.g. "Would you be open to a brief conversation about opportunities on your team?" or "Open to a brief chat to see if my background might be relevant for upcoming engineering needs?").
   - Do NOT end with vague phrases like "Let me know if anything fits" or "Keep my resume on file".

7. KEEP THE MESSAGE SHORT & FOCUSED:
   - Prioritize ONE strong, relevant connection over dumping multiple research facts or listing multiple past jobs.
   - Email: 80–150 words (2–3 short, easily scannable paragraphs).
   - LinkedIn: 40–80 words AND strictly under 300 characters total.

==================================================
TARGET PERSON AWARENESS
==================================================
Tailor the message according to who the recipient is:
- FOR A TALENT ACQUISITION PERSON / PARTNER:
  Focus on the candidate's relevant background, core capabilities, and potential opportunities on relevant teams.
- FOR A RECRUITER / TECHNICAL RECRUITER:
  Focus on specific relevant skills, engineering/domain experience, and the specific type of role the candidate could contribute to.
- FOR A FOUNDER / SENIOR LEADER:
  Connect the candidate's actual background directly to the company's actual product, business, or current direction. Do NOT force a founder-style message onto recruiters.
- RECIPIENT RESTRAINT:
  * Address them by first name (e.g. "Hi Jane,") if provided; otherwise "Hi there,".
  * Never claim that the recipient is hiring for something unless research confirms it.
  * Never claim that the recipient personally reviewed the resume or knows the candidate.

==================================================
BANNED AI PHRASES & CLICHÉS (NEVER USE)
==================================================
Strictly avoid:
- "I hope this message finds you well" / "I hope you're doing well"
- "I am excited to apply" / "I was thrilled to come across" / "I was impressed by"
- "I believe I would be a great fit" / "I believe my experience aligns perfectly"
- "I would love the opportunity" / "I am passionate about"
- "leveraging my extensive experience" / "proven track record"
- "dynamic team" / "innovative company" / "cutting-edge" / "fast-paced environment"
- "unique opportunity" / "valuable addition to your team"
- "contribute to the continued success" / "help drive growth" / "make a meaningful impact"
- "seamlessly integrate" / "testament to" / "spearheaded"
- "I am reaching out to express my interest in..."
- "Let me know if anything fits"

==================================================
FORMAT & OUTPUT
==================================================
Return a single JSON object with exactly this shape:
{
  "email_subject": string,
  "email_body": string,
  "linkedin_message": string
}
Output ONLY the JSON object. No markdown fences, no preamble.`;

export function buildCompanyOutreachMessagePrompt({
  company,
  targetPerson,
  profile,
  playbookExamples,
  tone,
  companyResearch,
}) {
  const toneLine = TONE_GUIDANCE[tone] || TONE_GUIDANCE.warm_professional;

  const playbookBlock = playbookExamples?.length
    ? `Candidate's own past messages (match this style and rhythm):\n${playbookExamples
        .map((ex, i) => `Example ${i + 1}:\n"""\n${ex}\n"""`)
        .join('\n\n')}`
    : `No past style examples provided — follow the tone guidance directly.`;

  // Determine recipient archetype guidance
  let personBlock = 'Target Recipient: General Talent Acquisition / Recruiting Team';
  let roleArchetypeGuidance = 'Focus on candidate\'s relevant background, concrete achievements, and potential alignment with upcoming hiring needs.';

  if (targetPerson && typeof targetPerson === 'object') {
    const title = targetPerson.title || 'Talent Acquisition';
    const lower = title.toLowerCase();

    if (/\b(founder|co-founder|ceo|cto|cpo|chief|president)\b/i.test(lower)) {
      roleArchetypeGuidance = 'RECIPIENT IS A FOUNDER / EXECUTIVE: Connect the candidate\'s actual background directly to the company\'s actual product, business, or current strategic direction. Do not treat them like a recruiter.';
    } else if (/\b(technical recruiter|tech recruiter|engineering recruiter)\b/i.test(lower)) {
      roleArchetypeGuidance = 'RECIPIENT IS A TECHNICAL RECRUITER: Focus on specific technical skills, concrete engineering achievements, scale, technologies, and the specific type of role the candidate could contribute to.';
    } else if (/\b(head of talent|director of talent|vp of talent|talent manager|recruiting manager|lead recruiter)\b/i.test(lower)) {
      roleArchetypeGuidance = 'RECIPIENT IS A TALENT LEADER / MANAGER: Focus on candidate\'s level of experience, proven track record, and potential strategic alignment with team growth and hiring priorities.';
    } else if (/\b(talent partner|talent acquisition partner|talent acquisition)\b/i.test(lower)) {
      roleArchetypeGuidance = 'RECIPIENT IS A TALENT ACQUISITION PARTNER: Focus on the candidate\'s relevant background, core capabilities, and potential opportunities on relevant teams.';
    }

    personBlock = `==================================================
TARGET RECIPIENT INFORMATION
==================================================
Name: ${targetPerson.name || 'Talent Leader'}
Title: ${title}
Company: ${company || targetPerson.company || 'Target Company'}
Why Relevant: ${targetPerson.relevance_reason || title || 'Recruiting for target company'}
Profile URL: ${targetPerson.profile_url || 'N/A'}
Verification: ${targetPerson.verification_reason || 'Verified current employee'}

Recipient Focus Directive:
${roleArchetypeGuidance}`;
  }

  let researchBlock = 'No external company research provided. Rely on candidate background and known company context without fabricating facts.';
  if (companyResearch && typeof companyResearch === 'object') {
    const companyName = companyResearch.company_name || company || 'Target Company';

    const devLines =
      Array.isArray(companyResearch.recent_developments) &&
      companyResearch.recent_developments.length > 0
        ? companyResearch.recent_developments
            .map((d, i) => {
              if (typeof d === 'string') return `  ${i + 1}. ${d}`;
              const dateStr = d.date ? ` [${d.date}]` : '';
              const headlineStr = d.headline ? `${d.headline}: ` : '';
              return `  ${i + 1}.${dateStr} ${headlineStr}${d.summary || ''}`;
            })
            .join('\n')
        : 'None provided';

    const sourcesList =
      Array.isArray(companyResearch.sources_used) &&
      companyResearch.sources_used.length > 0
        ? companyResearch.sources_used
            .map((s) => `  - ${s.title || 'Article'} (${s.url})`)
            .join('\n')
        : 'None';

    researchBlock = `==================================================
STRUCTURED COMPANY RESEARCH & PERSONALIZATION INTEL
==================================================
Target Company: ${companyName}

Recent Company Developments:
${devLines}

Relevance:
${companyResearch.relevance || 'N/A'}

Candidate Connection:
${companyResearch.candidate_connection || 'N/A'}

Suggested Conversation / Personalization Hook:
${companyResearch.conversation_hook || 'N/A'}

Sources Used:
${sourcesList}

CRITICAL RESEARCH INTEGRATION RULES:
1. Ground outreach in 1 specific, factual development from the research (e.g. recent product launch, funding, expansion).
2. Never invent company facts not supported by the research.
3. If research is sparse, use less personalization rather than inventing claims.`;
  }

  return `Requested tone: ${tone}
Tone guidance: ${toneLine}

${personBlock}

Candidate profile & background:
${JSON.stringify(profile, null, 2)}

${researchBlock}

${playbookBlock}

Generate a natural, human outreach email (80–150 words) and a concise LinkedIn note (strictly under 300 characters) tailored specifically to this recipient and company context.
Lead with concrete experience, reference 1 real company fact from research, keep numbers consistent, and end with ONE clear ask. Write like a real person starting a peer-to-peer conversation.`;
}

