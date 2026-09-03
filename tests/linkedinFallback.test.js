import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Fast mock for MongoDB collections during tests
globalThis.__jdOutreachMongoClientPromise = Promise.resolve({
  db: () => ({
    collection: () => ({
      insertOne: async () => ({ insertedId: 'mock-id' }),
      find: () => ({ toArray: async () => [] }),
      createIndex: async () => {},
      updateOne: async () => {},
    }),
  }),
});

import {
  isLinkedInHost,
  extractLinkedInJobId,
  isLinkedInJobUrl,
  parseLinkedInGuestJobHtml,
  validateExtractedJob,
  fetchLinkedInGuestJob,
} from '../lib/server/services/linkedinGuest.js';

import {
  fetchJobPosting,
  FetchBlockedError,
} from '../lib/server/services/tinyfish.js';

// Sample Mock HTML for LinkedIn Guest Job Posting
const SAMPLE_VALID_LINKEDIN_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Senior Software Engineer at Acme Corp</title>
</head>
<body>
  <div class="top-card-layout__entity-info">
    <h2 class="top-card-layout__title">Senior Full Stack Engineer</h2>
    <h4 class="top-card-layout__first-sub-headline">
      <a class="topcard__org-name-link" href="https://linkedin.com/company/acme">Acme Corporation</a>
    </h4>
    <h4 class="top-card-layout__second-sub-headline">
      <span class="topcard__flavor--bullet">San Francisco, CA (Hybrid)</span>
    </h4>
  </div>

  <ul class="description__job-criteria-list">
    <li class="description__job-criteria-item">
      <h3 class="description__job-criteria-subheader">Seniority level</h3>
      <span class="description__job-criteria-text">Mid-Senior level</span>
    </li>
    <li class="description__job-criteria-item">
      <h3 class="description__job-criteria-subheader">Employment type</h3>
      <span class="description__job-criteria-text">Full-time</span>
    </li>
    <li class="description__job-criteria-item">
      <h3 class="description__job-criteria-subheader">Job function</h3>
      <span class="description__job-criteria-text">Engineering and Information Technology</span>
    </li>
    <li class="description__job-criteria-item">
      <h3 class="description__job-criteria-subheader">Industries</h3>
      <span class="description__job-criteria-text">Software Development</span>
    </li>
  </ul>

  <div class="show-more-less-html__markup">
    <p>About the role:</p>
    <p>We are seeking a highly skilled Senior Full Stack Engineer to lead the architecture and development of our core web platform. You will build high-scale, resilient APIs and interactive frontend applications.</p>
    <p>Requirements:</p>
    <ul>
      <li>5+ years of experience with TypeScript, Node.js, and React.</li>
      <li>Strong experience with cloud services (AWS / GCP) and distributed systems.</li>
      <li>Proven track record of designing scalable REST / GraphQL APIs.</li>
      <li>Excellent problem-solving skills and team collaboration mindset.</li>
    </ul>
    <p>Benefits include competitive equity, 401(k) matching, comprehensive health coverage, and flexible remote work options.</p>
  </div>
</body>
</html>
`;

describe('LinkedIn Fallback Job Extraction Suite', () => {
  // 1. LinkedIn Job URL Detection
  describe('1. LinkedIn job URL detection', () => {
    it('correctly detects standard LinkedIn job URLs', () => {
      assert.equal(isLinkedInJobUrl('https://www.linkedin.com/jobs/view/123456789/'), true);
      assert.equal(isLinkedInJobUrl('https://linkedin.com/jobs/view/123456789'), true);
      assert.equal(isLinkedInJobUrl('https://uk.linkedin.com/jobs/view/4448119707/'), true);
      assert.equal(isLinkedInJobUrl('https://in.linkedin.com/jobs/view/senior-developer-4448119707?refId=xyz'), true);
    });
  });

  // 2. Non-LinkedIn URL Detection
  describe('2. Non-LinkedIn URL detection', () => {
    it('correctly rejects non-LinkedIn URLs', () => {
      assert.equal(isLinkedInJobUrl('https://greenhouse.io/jobs/123456'), false);
      assert.equal(isLinkedInJobUrl('https://boards.greenhouse.io/company/jobs/456'), false);
      assert.equal(isLinkedInJobUrl('https://indeed.com/viewjob?jk=123'), false);
      assert.equal(isLinkedInJobUrl('https://google.com/careers/jobs/789'), false);
      assert.equal(isLinkedInJobUrl('https://lever.co/company/job-id'), false);
    });
  });

  // 3. Malicious Hostname Detection
  describe('3. Malicious hostname spoofing prevention', () => {
    it('rejects spoofed subdomains and deceptive domains', () => {
      assert.equal(isLinkedInHost('https://linkedin.com.evil.com/jobs/view/123456789'), false);
      assert.equal(isLinkedInHost('https://evil-linkedin.com/jobs/view/123456789'), false);
      assert.equal(isLinkedInHost('https://notlinkedin.com/jobs/view/123456789'), false);
      assert.equal(isLinkedInHost('https://attacker.com/?redirect=linkedin.com'), false);

      assert.equal(isLinkedInJobUrl('https://linkedin.com.evil.com/jobs/view/123456789'), false);
      assert.equal(isLinkedInJobUrl('https://evil-linkedin.com/jobs/view/123456789'), false);
    });
  });

  // 4. LinkedIn Job ID Extraction
  describe('4. LinkedIn job ID extraction', () => {
    it('extracts numeric job ID from various URL formats', () => {
      assert.equal(extractLinkedInJobId('https://www.linkedin.com/jobs/view/4448119707/'), '4448119707');
      assert.equal(extractLinkedInJobId('https://linkedin.com/jobs/view/4448119707'), '4448119707');
      assert.equal(
        extractLinkedInJobId('https://www.linkedin.com/jobs/view/senior-lead-engineer-at-stripe-4448119707?trackingId=abc&refId=123'),
        '4448119707'
      );
      assert.equal(extractLinkedInJobId('https://de.linkedin.com/jobs/view/9988776655/'), '9988776655');
    });
  });

  // 5. Invalid LinkedIn URL Handling
  describe('5. Invalid LinkedIn URL handling', () => {
    it('returns null and rejects LinkedIn URLs without a valid numeric job ID', () => {
      assert.equal(extractLinkedInJobId('https://www.linkedin.com/feed/'), null);
      assert.equal(extractLinkedInJobId('https://www.linkedin.com/in/john-doe/'), null);
      assert.equal(extractLinkedInJobId('https://www.linkedin.com/jobs/search/?keywords=engineer'), null);
      assert.equal(extractLinkedInJobId('https://www.linkedin.com/jobs/view/not-a-number/'), null);
      assert.equal(isLinkedInJobUrl('https://www.linkedin.com/feed/'), false);
      assert.equal(isLinkedInJobUrl('https://www.linkedin.com/jobs/'), false);
    });
  });

  // 6. TinyFish Success -> Fallback NOT Called
  describe('6. TinyFish success → fallback NOT called', () => {
    it('does not invoke the LinkedIn guest fallback when TinyFish succeeds', async () => {
      let fallbackCalled = false;
      const mockTinyFishClient = {
        fetch: {
          getContents: async () => ({
            results: [
              {
                url: 'https://www.linkedin.com/jobs/view/4448119707/',
                title: 'Staff Engineer - Acme',
                text: 'We are hiring a Staff Engineer at Acme. You will build distributed cloud systems and lead technical initiatives across our engineering org. Minimum 8 years experience required.',
              },
            ],
            errors: [],
          }),
        },
      };

      const mockFetch = async () => {
        fallbackCalled = true;
        return new Response('Should not be called', { status: 200 });
      };

      const result = await fetchJobPosting('https://www.linkedin.com/jobs/view/4448119707/', {
        client: mockTinyFishClient,
        fetchFn: mockFetch,
      });

      assert.equal(fallbackCalled, false, 'Fallback must NOT be called on TinyFish success');
      assert.equal(result.provider, 'tinyfish');
      assert.equal(result.title, 'Staff Engineer - Acme');
      assert.match(result.rawText, /Staff Engineer/);
    });
  });

  // 7. TinyFish Failure + LinkedIn -> Fallback Called
  describe('7. TinyFish failure + LinkedIn → fallback called', () => {
    it('invokes LinkedIn guest fallback when TinyFish throws an error on a LinkedIn URL', async () => {
      let fallbackCalled = false;
      const mockTinyFishClient = {
        fetch: {
          getContents: async () => {
            throw new Error('TinyFish proxy blocked by LinkedIn');
          },
        },
      };

      const mockFetch = async (url) => {
        fallbackCalled = true;
        assert.match(url, /jobs-guest\/jobs\/api\/jobPosting\/4448119707/);
        return new Response(SAMPLE_VALID_LINKEDIN_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      };

      const result = await fetchJobPosting('https://www.linkedin.com/jobs/view/4448119707/', {
        client: mockTinyFishClient,
        fetchFn: mockFetch,
      });

      assert.equal(fallbackCalled, true, 'Fallback MUST be called when TinyFish fails on LinkedIn');
      assert.equal(result.provider, 'linkedin_guest');
      assert.equal(result.title, 'Senior Full Stack Engineer');
      assert.equal(result.company, 'Acme Corporation');
      assert.equal(result.location, 'San Francisco, CA (Hybrid)');
      assert.match(result.rawText, /Senior Full Stack Engineer/);
      assert.match(result.rawText, /About the role/);
    });

    it('invokes LinkedIn guest fallback when TinyFish returns a block page (login wall)', async () => {
      let fallbackCalled = false;
      const mockTinyFishClient = {
        fetch: {
          getContents: async () => ({
            results: [
              {
                url: 'https://www.linkedin.com/jobs/view/4448119707/',
                title: 'Sign In | LinkedIn',
                text: 'Join LinkedIn now to view this job. Sign in to continue with your account.',
              },
            ],
            errors: [],
          }),
        },
      };

      const mockFetch = async () => {
        fallbackCalled = true;
        return new Response(SAMPLE_VALID_LINKEDIN_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      };

      const result = await fetchJobPosting('https://www.linkedin.com/jobs/view/4448119707/', {
        client: mockTinyFishClient,
        fetchFn: mockFetch,
      });

      assert.equal(fallbackCalled, true);
      assert.equal(result.provider, 'linkedin_guest');
      assert.equal(result.title, 'Senior Full Stack Engineer');
    });
  });

  // 8. TinyFish Failure + Non-LinkedIn -> Fallback NOT Called
  describe('8. TinyFish failure + non-LinkedIn → fallback NOT called', () => {
    it('preserves existing failure behavior and throws FetchBlockedError without calling LinkedIn fallback', async () => {
      let fallbackCalled = false;
      const mockTinyFishClient = {
        fetch: {
          getContents: async () => {
            throw new Error('Upstream timeout');
          },
        },
      };

      const mockFetch = async () => {
        fallbackCalled = true;
        return new Response('Should not be called', { status: 200 });
      };

      await assert.rejects(
        async () => {
          await fetchJobPosting('https://boards.greenhouse.io/airbnb/jobs/123456', {
            client: mockTinyFishClient,
            fetchFn: mockFetch,
          });
        },
        (err) => {
          assert.equal(err.name, 'FetchBlockedError');
          return true;
        }
      );

      assert.equal(fallbackCalled, false, 'Fallback must NOT be called for non-LinkedIn domains');
    });
  });

  // 9. LinkedIn Endpoint Returns Valid Job -> Normalized Job Returned
  describe('9. LinkedIn endpoint returns valid job → normalized job returned', () => {
    it('correctly parses HTML and normalizes job fields', async () => {
      const mockFetch = async () =>
        new Response(SAMPLE_VALID_LINKEDIN_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });

      const parsed = await fetchLinkedInGuestJob('https://www.linkedin.com/jobs/view/4448119707/', {
        fetchFn: mockFetch,
      });

      assert.equal(parsed.title, 'Senior Full Stack Engineer');
      assert.equal(parsed.company, 'Acme Corporation');
      assert.equal(parsed.location, 'San Francisco, CA (Hybrid)');
      assert.equal(parsed.domain, 'linkedin.com');
      assert.equal(parsed.provider, 'linkedin_guest');
      assert.equal(parsed.criteria['Seniority level'], 'Mid-Senior level');
      assert.equal(parsed.criteria['Employment type'], 'Full-time');
      assert.match(parsed.description, /About the role/);
      assert.match(parsed.rawText, /# Senior Full Stack Engineer/);
      assert.match(parsed.rawText, /Company: Acme Corporation/);
      assert.match(parsed.rawText, /Location: San Francisco, CA/);
    });
  });

  // 10. LinkedIn Endpoint Returns 403 -> Fallback Fails Cleanly
  describe('10. LinkedIn endpoint returns 403 → fallback fails cleanly', () => {
    it('handles 403 Forbidden without throwing uncaught runtime exceptions and propagates FetchBlockedError', async () => {
      const mockTinyFishClient = {
        fetch: {
          getContents: async () => {
            throw new Error('TinyFish error');
          },
        },
      };

      const mockFetch = async () =>
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' });

      await assert.rejects(
        async () => {
          await fetchJobPosting('https://www.linkedin.com/jobs/view/4448119707/', {
            client: mockTinyFishClient,
            fetchFn: mockFetch,
          });
        },
        (err) => {
          assert.equal(err.name, 'FetchBlockedError');
          return true;
        }
      );
    });
  });

  // 11. LinkedIn Endpoint Returns 429 -> Fallback Fails Cleanly
  describe('11. LinkedIn endpoint returns 429 → fallback fails cleanly', () => {
    it('handles 429 Rate Limit without retrying aggressively and propagates FetchBlockedError', async () => {
      let requestCount = 0;
      const mockTinyFishClient = {
        fetch: {
          getContents: async () => {
            throw new Error('TinyFish error');
          },
        },
      };

      const mockFetch = async () => {
        requestCount++;
        return new Response('Too Many Requests', { status: 429, statusText: 'Too Many Requests' });
      };

      await assert.rejects(
        async () => {
          await fetchJobPosting('https://www.linkedin.com/jobs/view/4448119707/', {
            client: mockTinyFishClient,
            fetchFn: mockFetch,
          });
        },
        (err) => {
          assert.equal(err.name, 'FetchBlockedError');
          return true;
        }
      );

      assert.equal(requestCount, 1, 'Must not retry after 429');
    });
  });

  // 12. LinkedIn Endpoint Returns HTML Without Useful JD -> Validation Fails
  describe('12. LinkedIn endpoint returns HTML without useful JD → validation fails', () => {
    it('rejects authwall/login HTML and incomplete content', () => {
      const authwallHtml = `
        <html>
          <body>
            <h1>Sign in to LinkedIn</h1>
            <p>Join LinkedIn or sign in to continue.</p>
          </body>
        </html>
      `;
      const parsedAuthwall = parseLinkedInGuestJobHtml(authwallHtml, 'https://linkedin.com/jobs/view/123');
      assert.equal(parsedAuthwall, null);
      assert.equal(validateExtractedJob(parsedAuthwall), false);

      const emptyJob = {
        title: '',
        description: 'Short',
        rawText: 'Short',
      };
      assert.equal(validateExtractedJob(emptyJob), false);

      const missingDescJob = {
        title: 'Software Engineer',
        description: '',
        rawText: 'Title only',
      };
      assert.equal(validateExtractedJob(missingDescJob), false);
    });

    it('fails cleanly in fetchJobPosting when guest endpoint returns unparseable HTML', async () => {
      const mockTinyFishClient = {
        fetch: {
          getContents: async () => {
            throw new Error('TinyFish error');
          },
        },
      };

      const mockFetch = async () =>
        new Response('<html><body><h1>Join LinkedIn</h1><p>sign in to continue</p></body></html>', {
          status: 200,
        });

      await assert.rejects(
        async () => {
          await fetchJobPosting('https://www.linkedin.com/jobs/view/4448119707/', {
            client: mockTinyFishClient,
            fetchFn: mockFetch,
          });
        },
        (err) => {
          assert.equal(err.name, 'FetchBlockedError');
          return true;
        }
      );
    });
  });

  // 13. LinkedIn Endpoint Timeout -> Fallback Fails Cleanly
  describe('13. LinkedIn endpoint timeout → fallback fails cleanly', () => {
    it('handles request timeout gracefully and propagates FetchBlockedError', async () => {
      const mockTinyFishClient = {
        fetch: {
          getContents: async () => {
            throw new Error('TinyFish error');
          },
        },
      };

      const mockFetch = async () => {
        const timeoutErr = new Error('The operation was aborted');
        timeoutErr.name = 'AbortError';
        throw timeoutErr;
      };

      await assert.rejects(
        async () => {
          await fetchJobPosting('https://www.linkedin.com/jobs/view/4448119707/', {
            client: mockTinyFishClient,
            fetchFn: mockFetch,
          });
        },
        (err) => {
          assert.equal(err.name, 'FetchBlockedError');
          return true;
        }
      );
    });
  });

  // 14. Existing Generation Pipeline Continues Normally After Successful Fallback
  describe('14. Pipeline continuity with extracted content', () => {
    it('provides rawText and metadata that satisfy the downstream JD structuring requirements', async () => {
      const mockTinyFishClient = {
        fetch: {
          getContents: async () => {
            throw new Error('TinyFish failed');
          },
        },
      };

      const mockFetch = async () =>
        new Response(SAMPLE_VALID_LINKEDIN_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });

      const fetched = await fetchJobPosting('https://www.linkedin.com/jobs/view/4448119707/', {
        client: mockTinyFishClient,
        fetchFn: mockFetch,
      });

      // Downstream checks:
      // 1. rawText must be at least 50 chars for structuring prompt
      assert.ok(fetched.rawText);
      assert.ok(fetched.rawText.length >= 50);

      // 2. domain must be populated
      assert.equal(fetched.domain, 'linkedin.com');

      // 3. title must be populated
      assert.equal(fetched.title, 'Senior Full Stack Engineer');

      // 4. provider identifies fallback
      assert.equal(fetched.provider, 'linkedin_guest');
    });
  });
});
