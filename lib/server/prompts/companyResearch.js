export const COMPANY_RESEARCH_SYSTEM_PROMPT = `You are an executive recruiter and research intelligence analyst.
You will be given:
1. Target company name and target role title
2. Structured job description requirements
3. Candidate profile & resume background
4. Full text or snippets from recent company news, articles, and announcements

Your goal is to perform a deep research analysis connecting the company's recent real-world initiatives to the candidate's specific background to create compelling outreach angles.

Analyze the sources and extract:
1. recent_developments: 2-4 concrete, recent facts/initiatives/products/milestones about the company.
2. relevance: 1-2 sentences explaining why these developments matter for this specific role and team.
3. candidate_connection: 2-3 sentences tying the candidate's concrete experience, skills, or achievements directly to these developments.
4. conversation_hook: A 1-2 sentence compelling opener / hook tailored for outreach (natural, confident, specific, avoiding generic praise).
5. key_insights: 2-3 brief bullet points capturing strategic takeaways.
6. sources_used: List of source articles used with title and url.

Return a single JSON object with exactly this shape:
{
  "recent_developments": string[],
  "relevance": string,
  "candidate_connection": string,
  "conversation_hook": string,
  "key_insights": string[],
  "sources_used": [
    {
      "title": string,
      "url": string
    }
  ]
}

Rules:
- Be factual and ground insights strictly in the provided articles and candidate profile. Do not invent news or hallucinations.
- If no news articles or very sparse info is available, synthesize best possible insights from the role and company context without pretending there were recent news articles.
- Output ONLY the JSON object. No markdown fences, no preamble.`;

export function buildCompanyResearchPrompt({ company, roleTitle, jdStructured, profile, articles }) {
  const articlesBlock = (articles && articles.length > 0)
    ? articles.map((a, i) => `Source ${i + 1}: ${a.title || 'Article'} (${a.url})\n"""\n${(a.text || a.content || '').slice(0, 3000)}\n"""`).join('\n\n')
    : 'No external article text available. Analyze based on company and JD context.';

  return `Company: ${company || 'Unknown'}
Role Title: ${roleTitle || jdStructured?.role_title || 'Target Role'}

Structured Job Description:
${JSON.stringify(jdStructured || {}, null, 2)}

Candidate Profile:
${JSON.stringify(profile || {}, null, 2)}

Recent Company News & Articles:
${articlesBlock}`;
}
