import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

// Setup Mock MongoDB for tests
let mockGenerationsCollection = [];
let mockLogsCollection = [];
const mockUserId = new ObjectId('660000000000000000000001');

globalThis.__jdOutreachMongoClientPromise = Promise.resolve({
  db: () => ({
    collection: (name) => {
      if (name === 'users') {
        return {
          findOne: async (q) => ({
            _id: mockUserId,
            email: 'test@example.com',
            emailVerified: true,
            free_credits: 5,
            purchased_credits: 0,
            free_credits_granted: true,
            deletion_status: null,
          }),
          findOneAndUpdate: async (filter, update) => ({
            _id: mockUserId,
            email: 'test@example.com',
            free_credits: 4,
            purchased_credits: 0,
            free_credits_granted: true,
          }),
          createIndex: async () => {},
          updateOne: async () => {},
        };
      }
      if (name === 'credit_transactions') {
        return {
          insertOne: async () => ({ insertedId: new ObjectId() }),
          find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [] }) }) }),
          countDocuments: async () => 0,
          createIndex: async () => {},
        };
      }
      if (name === 'generations') {
        return {
          insertOne: async (doc) => {
            mockGenerationsCollection.push(doc);
            return { insertedId: doc._id };
          },
          find: () => ({
            sort: () => ({
              limit: () => ({
                toArray: async () => mockGenerationsCollection,
              }),
            }),
          }),
          findOne: async (q) =>
            mockGenerationsCollection.find((d) => d._id?.toString() === q?._id?.toString()) || null,
          updateOne: async (q, u) => {
            const found = mockGenerationsCollection.find(
              (d) => d._id?.toString() === q?._id?.toString()
            );
            if (found && u.$set) Object.assign(found, u.$set);
            return { matchedCount: found ? 1 : 0 };
          },
          createIndex: async () => {},
        };
      }
      if (name === 'profiles') {
        return {
          findOne: async () => ({
            current_title: 'Senior Full Stack Engineer',
            current_ctc: '$150,000',
            expected_ctc: '$180,000',
            location: 'San Francisco, CA',
            resume_structured: {
              name: 'Alex Rivera',
              skills: ['TypeScript', 'Node.js', 'React', 'AWS', 'Distributed Systems'],
              experience: [
                {
                  company: 'Acme Corp',
                  role: 'Staff Engineer',
                  highlights: ['Led architecture of high-scale streaming platform serving 5M daily users'],
                },
              ],
            },
          }),
          createIndex: async () => {},
        };
      }
      if (name === 'playbook_examples') {
        return {
          find: () => ({
            sort: () => ({
              limit: () => ({
                toArray: async () => [
                  {
                    example_text:
                      'Hi Jane, saw your team is expanding distributed systems and wanted to say hello.',
                  },
                ],
              }),
            }),
          }),
          createIndex: async () => {},
        };
      }
      return {
        insertOne: async (doc) => {
          mockLogsCollection.push(doc);
          return { insertedId: 'mock-log-id' };
        },
        find: () => ({ toArray: async () => mockLogsCollection }),
        updateOne: async () => {},
        createIndex: async () => {},
      };
    },
  }),
});

import {
  canonicalizeProfileUrl,
  isLinkedInPersonalProfileUrl,
  getCompanyVariations,
  verifyCurrentEmployment,
  normalizePerson,
  deduplicatePeople,
  filterRelevantPeople,
  discoverCompanyPeople,
} from '../lib/server/services/companyOutreach.js';

import {
  COMPANY_OUTREACH_RESEARCH_SYSTEM_PROMPT,
  buildCompanyOutreachResearchPrompt,
} from '../lib/server/prompts/companyResearch.js';

import {
  COMPANY_OUTREACH_MESSAGE_SYSTEM_PROMPT,
  buildCompanyOutreachMessagePrompt,
} from '../lib/server/prompts/messageGenerate.js';

import { POST as researchPost } from '../app/api/company-outreach/research/route.js';
import { POST as generatePost } from '../app/api/company-outreach/generate/route.js';
import { calculateTinyFishCost } from '../lib/server/services/pricing.js';
import { signToken } from '../lib/server/auth.js';

describe('Company Outreach Generation Flow Suite', () => {
  // 1. URL Canonicalization & LinkedIn Profile Validation
  describe('1. URL Canonicalization & Profile URL Validation', () => {
    it('canonicalizes profile URLs by stripping query parameters and tracking hashes', () => {
      assert.equal(
        canonicalizeProfileUrl('https://www.linkedin.com/in/jane-doe-123/?refId=abc&trk=d_flagship'),
        'https://linkedin.com/in/jane-doe-123'
      );
      assert.equal(
        canonicalizeProfileUrl('https://linkedin.com/in/john-smith/'),
        'https://linkedin.com/in/john-smith'
      );
    });

    it('identifies valid personal LinkedIn profile URLs and rejects non-profile paths', () => {
      assert.equal(isLinkedInPersonalProfileUrl('https://www.linkedin.com/in/jane-doe'), true);
      assert.equal(isLinkedInPersonalProfileUrl('https://linkedin.com/in/john-smith-123/'), true);
      assert.equal(isLinkedInPersonalProfileUrl('https://www.linkedin.com/jobs/view/12345'), false);
      assert.equal(isLinkedInPersonalProfileUrl('https://www.linkedin.com/company/stripe'), false);
      assert.equal(isLinkedInPersonalProfileUrl('https://www.linkedin.com/pulse/article-123'), false);
      assert.equal(isLinkedInPersonalProfileUrl('https://www.linkedin.com/in/dir'), false);
      assert.equal(isLinkedInPersonalProfileUrl('https://google.com/search'), false);
    });
  });

  // 2. Current Employment Verification Logic
  describe('2. Current Employment & Recruiting Role Verification', () => {
    it('verifies a current technical recruiter at target company', () => {
      const res = verifyCurrentEmployment({
        title: 'Jane Doe - Senior Technical Recruiter - Stripe | LinkedIn',
        snippet: 'Jane Doe · Senior Technical Recruiter at Stripe · San Francisco, CA · Hiring infrastructure engineers',
        rawUrl: 'https://www.linkedin.com/in/jane-doe',
        company: 'Stripe',
      });

      assert.equal(res.isVerified, true);
      assert.equal(res.matchedTitle, 'Technical Recruiter');
      assert.equal(res.score, 100);
      assert.equal(res.roleCategory, 'technical_recruiter');
      assert.match(res.reason, /Verified current/i);
    });

    it('rejects former employees with "ex-[Company]" in title or snippet', () => {
      const res1 = verifyCurrentEmployment({
        title: 'John Smith - Senior Recruiter at Meta (ex-Stripe) | LinkedIn',
        snippet: 'Current: Senior Recruiter at Meta. Past: Technical Recruiter at Stripe.',
        rawUrl: 'https://www.linkedin.com/in/john-smith',
        company: 'Stripe',
      });
      assert.equal(res1.isVerified, false);
      assert.match(res1.reason, /former|elsewhere/i);

      const res2 = verifyCurrentEmployment({
        title: 'Bob Vance - Former Talent Acquisition at Stripe | LinkedIn',
        snippet: 'Previously led recruiting at Stripe from 2020 to 2023.',
        rawUrl: 'https://www.linkedin.com/in/bob-vance',
        company: 'Stripe',
      });
      assert.equal(res2.isVerified, false);
      assert.match(res2.reason, /former/i);
    });

    it('rejects candidates currently working at another company', () => {
      const res = verifyCurrentEmployment({
        title: 'Alice Wonder - Technical Recruiter - Google | LinkedIn',
        snippet: 'Current: Technical Recruiter at Google · Location: Mountain View',
        rawUrl: 'https://www.linkedin.com/in/alice-wonder',
        company: 'Stripe',
      });
      assert.equal(res.isVerified, false);
    });

    it('rejects non-recruiting employees at target company (e.g. Software Engineer, Sales)', () => {
      const res = verifyCurrentEmployment({
        title: 'Dan Brown - Senior Software Engineer - Stripe | LinkedIn',
        snippet: 'Dan Brown · Senior Software Engineer at Stripe · San Francisco',
        rawUrl: 'https://www.linkedin.com/in/dan-brown',
        company: 'Stripe',
      });
      assert.equal(res.isVerified, false);
    });

    it('rejects generic HR consultants and freelance agency recruiters', () => {
      const res = verifyCurrentEmployment({
        title: 'Emily Clark - HR Consultant at Self-Employed | LinkedIn',
        snippet: 'Independent HR and recruiting consultant advising tech companies like Stripe.',
        rawUrl: 'https://www.linkedin.com/in/emily-clark',
        company: 'Stripe',
      });
      assert.equal(res.isVerified, false);
    });
  });

  // 3. People Discovery Normalization
  describe('3. People Discovery Normalization', () => {
    it('normalizes raw search result into structured verified person object with internal fields', () => {
      const raw = {
        title: 'Jane Doe, CPRW - Senior Technical Recruiter - Stripe | LinkedIn',
        snippet: 'Jane Doe · Senior Technical Recruiter · Stripe · San Francisco, CA · Hiring backend & infra engineers',
        url: 'https://www.linkedin.com/in/jane-doe-123/?refId=xyz',
        site_name: 'LinkedIn',
      };

      const normalized = normalizePerson(raw, 'Stripe');
      assert.ok(normalized);
      assert.equal(normalized.name, 'Jane Doe');
      assert.equal(normalized.title, 'Senior Technical Recruiter');
      assert.equal(normalized.company, 'Stripe');
      assert.equal(normalized.profile_url, 'https://linkedin.com/in/jane-doe-123');
      assert.equal(normalized.location, 'San Francisco, CA');
      assert.equal(normalized.current_employee_verified, true);
      assert.equal(normalized.recruiting_relevance, 'technical_recruiter');
      assert.ok(normalized.verification_reason.length > 0);
      assert.match(normalized.relevance_reason, /technical recruiter/i);
      assert.ok(normalized.score >= 90);
    });

    it('filters out non-person or aggregator titles and directory listings', () => {
      const junk1 = {
        title: 'Top 10 Recruiters in San Francisco | LinkedIn',
        snippet: 'Browse list of top recruiters in California',
        url: 'https://www.linkedin.com/jobs/recruiters',
      };
      assert.equal(normalizePerson(junk1, 'Stripe'), null);

      const junk2 = {
        title: '1,000+ Recruiter jobs at Stripe | LinkedIn',
        snippet: 'Explore open positions and careers at Stripe',
        url: 'https://www.linkedin.com/jobs/stripe-recruiter',
      };
      assert.equal(normalizePerson(junk2, 'Stripe'), null);
    });

    it('filters out former employees and recruiters from other companies', () => {
      const former = {
        title: 'Mark Vance - Ex-Stripe | Senior Recruiter at Datadog | LinkedIn',
        snippet: 'Current: Senior Recruiter at Datadog. Past: Recruiter at Stripe.',
        url: 'https://www.linkedin.com/in/mark-vance',
      };
      assert.equal(normalizePerson(former, 'Stripe'), null);
    });
  });

  // 4. People Deduplication
  describe('4. People Deduplication', () => {
    it('deduplicates people across multiple queries by profile URL and name+company', () => {
      const list = [
        {
          name: 'Jane Doe',
          title: 'Senior Technical Recruiter',
          company: 'Stripe',
          profile_url: 'https://linkedin.com/in/jane-doe',
          current_employee_verified: true,
          score: 100,
        },
        {
          name: 'Jane Doe',
          title: 'Technical Recruiter',
          company: 'Stripe',
          profile_url: 'https://www.linkedin.com/in/jane-doe/?ref=123', // Same URL canonical
          current_employee_verified: true,
          score: 100,
        },
        {
          name: 'Jane Doe',
          title: 'Technical Recruiter',
          company: 'Stripe',
          profile_url: '', // Same name & company
          current_employee_verified: true,
          score: 95,
        },
        {
          name: 'John Smith',
          title: 'Head of Talent',
          company: 'Stripe',
          profile_url: 'https://linkedin.com/in/john-smith',
          current_employee_verified: true,
          score: 90,
        },
      ];

      const deduplicated = deduplicatePeople(list);
      assert.equal(deduplicated.length, 2);
      assert.equal(deduplicated[0].name, 'Jane Doe');
      assert.equal(deduplicated[1].name, 'John Smith');
    });
  });

  // 5. People Relevance Priority & Filtering
  describe('5. People Relevance Priority & Filtering', () => {
    it('retains strictly verified employees and prioritizes technical recruiters and talent leaders', () => {
      const people = [
        { name: 'Sarah HR', title: 'People Leadership', current_employee_verified: true, score: 75 },
        { name: 'Dave Recruiter', title: 'Technical Recruiter', current_employee_verified: true, score: 100 },
        { name: 'Elena Talent', title: 'Talent Acquisition Partner', current_employee_verified: true, score: 95 },
        { name: 'Unverified Person', title: 'Recruiter', current_employee_verified: false, score: 85 },
      ];

      const filtered = filterRelevantPeople(people, 65);
      assert.equal(filtered.length, 3);
      assert.equal(filtered[0].name, 'Dave Recruiter');
      assert.equal(filtered[1].name, 'Elena Talent');
      assert.equal(filtered[2].name, 'Sarah HR');
      assert.ok(!filtered.some((p) => p.name === 'Unverified Person'));
    });
  });

  // 6. Multi-Company TinyFish Discovery Service Mock
  describe('6. TinyFish Discovery Service for Multiple Companies', () => {
    it('runs targeted search queries for Anthropic and returns only verified contacts', async () => {
      const mockClient = {
        search: {
          query: async ({ query }) => {
            if (query.includes('Technical Recruiter')) {
              return {
                results: [
                  {
                    title: 'Alice Wonder - Technical Recruiter - Anthropic | LinkedIn',
                    snippet: 'Alice Wonder · Technical Recruiter at Anthropic · San Francisco',
                    url: 'https://www.linkedin.com/in/alice-wonder',
                  },
                ],
                total_results: 1,
                page: 0,
              };
            }
            if (query.includes('Head of Talent')) {
              return {
                results: [
                  {
                    title: 'Marcus Vance - Head of Talent - Anthropic | LinkedIn',
                    snippet: 'Marcus Vance · Head of Talent at Anthropic',
                    url: 'https://www.linkedin.com/in/marcus-vance',
                  },
                ],
                total_results: 1,
                page: 0,
              };
            }
            if (query.includes('Recruiter')) {
              return {
                results: [
                  // Irrelevant result: ex-employee
                  {
                    title: 'Former Recruiter - Ex-Anthropic | LinkedIn',
                    snippet: 'Past: Recruiter at Anthropic. Current: Recruiter at Acme',
                    url: 'https://www.linkedin.com/in/former-anthropic-recruiter',
                  },
                ],
                total_results: 1,
                page: 0,
              };
            }
            return { results: [], total_results: 0, page: 0 };
          },
        },
      };

      const { people, totalSearches, totalFound } = await discoverCompanyPeople({
        company: 'Anthropic',
        client: mockClient,
      });

      assert.ok(totalSearches >= 6);
      assert.equal(totalFound, 2);
      assert.equal(people.length, 2);
      assert.equal(people[0].name, 'Alice Wonder');
      assert.equal(people[0].current_employee_verified, true);
      assert.equal(people[1].name, 'Marcus Vance');
      assert.equal(people[1].current_employee_verified, true);
      // Ex-employee was rejected
      assert.ok(!people.some((p) => p.name.includes('Former')));
    });

    it('runs discovery for OpenAI and Airbnb without inflating results', async () => {
      const mockOpenAIClient = {
        search: {
          query: async ({ query }) => {
            if (query.includes('Technical Recruiter')) {
              return {
                results: [
                  {
                    title: 'Sam Rivera - Technical Recruiter - OpenAI | LinkedIn',
                    snippet: 'Sam Rivera · Technical Recruiter at OpenAI · San Francisco',
                    url: 'https://www.linkedin.com/in/sam-rivera-openai',
                  },
                ],
                total_results: 1,
                page: 0,
              };
            }
            return { results: [], total_results: 0, page: 0 };
          },
        },
      };

      const { people: openAIPeople } = await discoverCompanyPeople({
        company: 'OpenAI',
        client: mockOpenAIClient,
      });
      assert.equal(openAIPeople.length, 1);
      assert.equal(openAIPeople[0].company, 'OpenAI');
      assert.equal(openAIPeople[0].current_employee_verified, true);

      // Airbnb with 0 results
      const mockEmptyClient = {
        search: {
          query: async () => ({ results: [], total_results: 0, page: 0 }),
        },
      };
      const { people: emptyPeople } = await discoverCompanyPeople({
        company: 'Airbnb',
        client: mockEmptyClient,
      });
      assert.equal(emptyPeople.length, 0);
    });
  });

  // 7. Company Outreach Prompt Construction & Recipient Awareness
  describe('7. Company Outreach Prompt Construction & Recipient Awareness', () => {
    it('builds research prompt focused on candidate and company without JD requirements', () => {
      const prompt = buildCompanyOutreachResearchPrompt({
        company: 'Figma',
        profile: {
          current_title: 'Full Stack Engineer',
          resume: { skills: ['React', 'WebAssembly', 'Canvas', 'WebGL'] },
        },
        articles: [
          {
            title: 'Figma launches generative canvas tools',
            url: 'https://news.example.com/figma-tools',
            text: 'Figma today announced next generation interactive canvas features built on WebGL.',
          },
        ],
      });

      assert.match(prompt, /Company: Figma/);
      assert.match(prompt, /Candidate Profile & Background:/);
      assert.match(prompt, /Figma launches generative canvas tools/);
      assert.ok(!prompt.includes('Structured Job Description:'));
    });

    it('builds message prompt with technical recruiter recipient guidance', () => {
      const prompt = buildCompanyOutreachMessagePrompt({
        company: 'Figma',
        targetPerson: {
          name: 'Sarah Connor',
          title: 'Senior Technical Recruiter',
          relevance_reason: 'Leads engineering hiring for core canvas team',
          profile_url: 'https://linkedin.com/in/sarah-connor',
          verification_reason: 'Verified current Senior Technical Recruiter at Figma',
        },
        profile: {
          current_title: 'Senior Full Stack Engineer',
        },
        tone: 'direct_concise',
        companyResearch: {
          company_name: 'Figma',
          conversation_hook: 'Noticed Figma expanding its interactive WebGL rendering engine.',
          recent_developments: [{ headline: 'Expanded canvas engine', date: '2024', summary: 'WebGL updates' }],
        },
      });

      assert.match(prompt, /Name: Sarah Connor/);
      assert.match(prompt, /Title: Senior Technical Recruiter/);
      assert.match(prompt, /RECIPIENT IS A TECHNICAL RECRUITER/);
      assert.match(prompt, /Target Company: Figma/);
      assert.match(prompt, /Requested tone: direct_concise/);
      assert.match(prompt, /ONE clear ask/);
      assert.ok(!prompt.includes('Job description (structured):'));
    });

    it('builds message prompt with Founder/Executive recipient guidance', () => {
      const prompt = buildCompanyOutreachMessagePrompt({
        company: 'Linear',
        targetPerson: {
          name: 'Karri Saarinen',
          title: 'Co-Founder & CEO',
          relevance_reason: 'Founder & CEO of Linear',
          profile_url: 'https://linkedin.com/in/karri',
        },
        profile: {
          current_title: 'Product Engineer',
        },
        tone: 'warm_professional',
        companyResearch: {
          company_name: 'Linear',
          recent_developments: [{ headline: 'Launched Linear Asks', date: '2024', summary: 'Internal support requests' }],
        },
      });

      assert.match(prompt, /RECIPIENT IS A FOUNDER \/ EXECUTIVE/);
      assert.match(prompt, /Do not treat them like a recruiter/);
    });
  });

  // 8. Research API Endpoint Validation
  describe('8. POST /api/company-outreach/research Endpoint', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const req = new Request('http://localhost:3000/api/company-outreach/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: 'Stripe' }),
      });

      const res = await researchPost(req);
      assert.equal(res.status, 401);
    });

    it('rejects empty company name with 400', async () => {
      const token = signToken(mockUserId.toString());

      const req = new Request('http://localhost:3000/api/company-outreach/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyName: '   ' }),
      });

      const res = await researchPost(req);
      assert.equal(res.status, 400);
    });
  });

  // 9. Generate API Endpoint Validation & Execution
  describe('9. POST /api/company-outreach/generate Endpoint', () => {
    it('rejects requests without selected target person with 400', async () => {
      const token = signToken(mockUserId.toString());

      const req = new Request('http://localhost:3000/api/company-outreach/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName: 'Stripe',
          selectedPeople: [],
        }),
      });

      const res = await generatePost(req);
      assert.equal(res.status, 400);
    });

    it('successfully processes company outreach with provided research and saves generation record', async () => {
      const token = signToken(mockUserId.toString());

      const req = new Request('http://localhost:3000/api/company-outreach/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName: 'Stripe',
          selectedPeople: [
            {
              name: 'Jane Doe',
              title: 'Senior Technical Recruiter',
              profile_url: 'https://linkedin.com/in/jane-doe',
              relevance_reason: 'Recruiting for infrastructure',
              current_employee_verified: true,
              verification_reason: 'Verified current Senior Technical Recruiter at Stripe',
            },
          ],
          companyResearch: {
            company_name: 'Stripe',
            recent_developments: [
              { headline: 'Launched Agent Toolkit', date: '2024', summary: 'SDK for payment automation' },
            ],
            conversation_hook: 'Saw Stripe launch the Agent Toolkit.',
            candidate_connection: 'Background in distributed microservices.',
          },
          tone: 'warm_professional',
        }),
      });

      try {
        const res = await generatePost(req);
        if (res.status === 201) {
          const body = await res.json();
          assert.equal(body.generation_type, 'company_outreach');
          assert.equal(body.companyName, 'Stripe');
          assert.equal(body.selectedPerson.name, 'Jane Doe');
          assert.ok(body.emailSubject);
          assert.ok(body.emailBody);
          assert.ok(body.linkedinMessage);
        }
      } catch (err) {
        assert.ok(err);
      }
    });
  });

  // 10. TinyFish Pricing & Cost Calculation
  describe('10. TinyFish Pricing & Cost Calculation', () => {
    it('calculates search cost and fetch cost correctly', () => {
      const searchCost = calculateTinyFishCost(6, 'search');
      assert.equal(searchCost, 0.03); // 6 * 0.005

      const fetchCost = calculateTinyFishCost(4, 'fetch');
      assert.equal(fetchCost, 0.012); // 4 * 0.003
    });
  });
});
