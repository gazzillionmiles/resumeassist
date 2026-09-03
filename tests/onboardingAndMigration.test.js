import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { isProfileComplete, getMissingProfileFields } from '../lib/server/profile.js';
import { runWorkAuthMigration } from '../scripts/migrate-remove-work-auth.js';
import { signToken } from '../lib/server/auth.js';

// Setup Mock In-Memory Database for profiles and users
const testUserId = new ObjectId('660000000000000000000099');
const testUserIdStr = testUserId.toString();

let mockProfiles = [];
let mockUsers = [];
let mockPlaybookExamples = [];
let mockGenerations = [];
let mockCreditTransactions = [];

mockUsers = [
  {
    _id: testUserId,
    email: 'newuser@example.com',
    password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    emailVerified: true,
    free_credits: 5,
    purchased_credits: 0,
    free_credits_granted: true,
    deletion_status: 'active',
    created_at: new Date(),
  },
];

globalThis.__jdOutreachMongoClientPromise = Promise.resolve({
  db: () => ({
    collection: (name) => {
      if (name === 'users') {
        return {
          createIndex: async () => {},
          findOne: async (q) => {
            if (q._id) {
              return mockUsers.find((u) => u._id.toString() === q._id.toString()) || null;
            }
            if (q.email) {
              return mockUsers.find((u) => u.email === q.email) || null;
            }
            return mockUsers[0] || null;
          },
          findOneAndUpdate: async (filter, update) => {
            const user = mockUsers.find((u) => u._id.toString() === filter._id?.toString());
            if (!user) return null;
            if (update.$inc) {
              for (const [k, v] of Object.entries(update.$inc)) {
                user[k] = (user[k] || 0) + v;
              }
            }
            if (update.$set) Object.assign(user, update.$set);
            return user;
          },
          updateOne: async (q, u) => {
            const user = mockUsers.find((usr) => usr._id.toString() === q._id?.toString());
            if (user) {
              if (u.$set) Object.assign(user, u.$set);
              return { matchedCount: 1 };
            }
            return { matchedCount: 0 };
          },
        };
      }

      if (name === 'profiles') {
        return {
          createIndex: async () => {},
          findOne: async (q) => {
            return mockProfiles.find((p) => p.user_id === q.user_id) || null;
          },
          updateOne: async (filter, update, options) => {
            let doc = mockProfiles.find((p) => p.user_id === filter.user_id);
            if (!doc && options?.upsert) {
              doc = { _id: new ObjectId(), user_id: filter.user_id, ...update.$setOnInsert };
              mockProfiles.push(doc);
            }
            if (doc) {
              if (update.$set) Object.assign(doc, update.$set);
              if (update.$unset) {
                for (const key of Object.keys(update.$unset)) {
                  delete doc[key];
                }
              }
              return { matchedCount: 1, upsertedCount: options?.upsert ? 1 : 0 };
            }
            return { matchedCount: 0, upsertedCount: 0 };
          },
          updateMany: async (filter, update) => {
            let count = 0;
            for (const doc of mockProfiles) {
              if (update.$unset) {
                for (const key of Object.keys(update.$unset)) {
                  if (doc[key] !== undefined) {
                    delete doc[key];
                    count++;
                  }
                }
              }
            }
            return { matchedCount: mockProfiles.length, modifiedCount: count };
          },
          deleteMany: async () => ({ deletedCount: 1 }),
        };
      }

      if (name === 'credit_transactions') {
        return {
          createIndex: async () => {},
          insertOne: async (doc) => { mockCreditTransactions.push(doc); return { insertedId: new ObjectId() }; },
        };
      }

      if (name === 'playbook_examples') {
        return {
          createIndex: async () => {},
          find: () => ({
            sort: () => ({
              limit: () => ({
                toArray: async () => mockPlaybookExamples,
              }),
            }),
          }),
        };
      }

      if (name === 'generations') {
        return {
          createIndex: async () => {},
          insertOne: async (doc) => { mockGenerations.push(doc); return { insertedId: doc._id }; },
          findOne: async () => null,
        };
      }

      return {
        createIndex: async () => {},
        findOne: async () => null,
        find: () => ({ toArray: async () => [] }),
      };
    },
  }),
});

// Import route handlers after database mock
const { GET: getProfile, POST: postProfile } = await import('../app/api/profile/route.js');
const { GET: getMe } = await import('../app/api/auth/me/route.js');
const { POST: postGenerate } = await import('../app/api/generate/route.js');

describe('Onboarding Flow, Profile Completeness & Work Authorization Migration Suite', () => {
  beforeEach(() => {
    mockProfiles = [];
    mockGenerations = [];
  });

  describe('1. Profile Completeness Logic (isProfileComplete & getMissingProfileFields)', () => {
    it('returns false and lists all missing fields for null or empty profile', () => {
      assert.equal(isProfileComplete(null), false);
      const missing = getMissingProfileFields(null);
      assert.deepEqual(missing, ['resume', 'current_title', 'location', 'current_ctc', 'expected_ctc', 'notice_period']);
    });

    it('returns false when resume is missing despite other fields present', () => {
      const partialProfile = {
        current_title: 'Full Stack Engineer',
        location: 'San Francisco, CA',
        current_ctc: '$140k',
        expected_ctc: '$170k',
        notice_period: 'Immediate',
      };
      assert.equal(isProfileComplete(partialProfile), false);
      assert.deepEqual(getMissingProfileFields(partialProfile), ['resume']);
    });

    it('returns false when any required text field is empty or whitespace', () => {
      const missingTitle = {
        resume_structured: { name: 'Alice', title: 'Engineer', skills: ['React'] },
        current_title: '   ',
        location: 'Remote',
        current_ctc: '$120,000',
        expected_ctc: '$150,000',
        notice_period: '30 Days',
      };
      assert.equal(isProfileComplete(missingTitle), false);
      assert.deepEqual(getMissingProfileFields(missingTitle), ['current_title']);

      const missingNotice = {
        resume_structured: { name: 'Alice', title: 'Engineer', skills: ['React'] },
        current_title: 'Software Engineer',
        location: 'Remote',
        current_ctc: '$120,000',
        expected_ctc: '$150,000',
        notice_period: '',
      };
      assert.equal(isProfileComplete(missingNotice), false);
      assert.deepEqual(getMissingProfileFields(missingNotice), ['notice_period']);
    });

    it('returns true when resume and all 5 core fields are filled (without requiring work authorization)', () => {
      const completeProfile = {
        resume_structured: { name: 'Jane Doe', title: 'Senior Engineer', skills: ['TypeScript', 'Node.js'] },
        current_title: 'Senior Software Engineer',
        location: 'San Francisco, CA (or Remote)',
        current_ctc: '$150,000',
        expected_ctc: '$180,000',
        notice_period: '15 Days',
      };
      assert.equal(isProfileComplete(completeProfile), true);
      assert.deepEqual(getMissingProfileFields(completeProfile), []);
    });
  });

  describe('2. Database Migration: Unset Work Authorization Fields', () => {
    it('removes work_auth, workAuth, and work_authorization fields across documents', async () => {
      mockProfiles = [
        {
          _id: new ObjectId(),
          user_id: 'user_1',
          current_title: 'Backend Engineer',
          location: 'NYC',
          work_auth: 'US Citizen',
          workAuth: 'US Citizen',
        },
        {
          _id: new ObjectId(),
          user_id: 'user_2',
          current_title: 'Product Designer',
          location: 'Austin, TX',
          work_authorization: 'Green Card',
        },
      ];

      const client = await globalThis.__jdOutreachMongoClientPromise;
      const res = await runWorkAuthMigration(null, client.db());
      assert.equal(res.matchedCount, 2);
      assert.ok(res.modifiedCount >= 2);

      // Verify work_auth is stripped from in-memory objects
      assert.equal(mockProfiles[0].work_auth, undefined);
      assert.equal(mockProfiles[0].workAuth, undefined);
      assert.equal(mockProfiles[1].work_authorization, undefined);
    });
  });

  describe('3. Profile API Endpoints (/api/profile)', () => {
    it('GET /api/profile returns null for new user with no profile', async () => {
      const token = signToken(testUserIdStr);
      const req = new Request('http://localhost:3000/api/profile', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await getProfile(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data, null); // No profile yet
    });

    it('POST /api/profile saves core fields without work_auth and unsets legacy fields', async () => {
      const token = signToken(testUserIdStr);
      const req = new Request('http://localhost:3000/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_title: 'Staff Platform Engineer',
          location: 'Bengaluru, India',
          current_ctc: '₹40 LPA',
          expected_ctc: '₹55 LPA',
          notice_period: '30 Days',
        }),
      });

      const res = await postProfile(req);
      assert.equal(res.status, 204);

      const saved = mockProfiles.find((p) => p.user_id === testUserIdStr);
      assert.ok(saved);
      assert.equal(saved.current_title, 'Staff Platform Engineer');
      assert.equal(saved.location, 'Bengaluru, India');
      assert.equal(saved.current_ctc, '₹40 LPA');
      assert.equal(saved.expected_ctc, '₹55 LPA');
      assert.equal(saved.notice_period, '30 Days');
      assert.equal(saved.work_auth, undefined);
    });

    it('GET /api/profile returns is_complete: true once resume and core details exist', async () => {
      // Setup complete profile
      mockProfiles = [
        {
          _id: new ObjectId(),
          user_id: testUserIdStr,
          current_title: 'Staff Platform Engineer',
          location: 'Bengaluru, India',
          current_ctc: '₹40 LPA',
          expected_ctc: '₹55 LPA',
          notice_period: '30 Days',
          resume_structured: { name: 'Alex Smith', skills: ['Go', 'Kubernetes'] },
          resume_filename: 'resume.pdf',
        },
      ];

      const token = signToken(testUserIdStr);
      const req = new Request('http://localhost:3000/api/profile', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await getProfile(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.is_complete, true);
      assert.deepEqual(data.missing_fields, []);
      assert.equal(data.current_title, 'Staff Platform Engineer');
      assert.equal(data.work_auth, undefined);
    });
  });

  describe('4. Auth API /api/auth/me Profile Status', () => {
    it('returns is_profile_complete: true when profile is full', async () => {
      mockProfiles = [
        {
          _id: new ObjectId(),
          user_id: testUserIdStr,
          current_title: 'Staff Platform Engineer',
          location: 'Bengaluru, India',
          current_ctc: '₹40 LPA',
          expected_ctc: '₹55 LPA',
          notice_period: '30 Days',
          resume_structured: { name: 'Alex Smith', skills: ['Go', 'Kubernetes'] },
          resume_filename: 'resume.pdf',
        },
      ];

      const token = signToken(testUserIdStr);
      const req = new Request('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await getMe(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.user.is_profile_complete, true);
    });

    it('returns is_profile_complete: false when profile is missing or incomplete', async () => {
      mockProfiles = []; // Clear profiles
      const token = signToken(testUserIdStr);
      const req = new Request('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await getMe(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.user.is_profile_complete, false);
    });
  });

  describe('5. Generation Enforcement: /api/generate blocks incomplete profile', () => {
    it('rejects generation with 400 PROFILE_INCOMPLETE when profile is incomplete', async () => {
      mockProfiles = []; // No profile
      const token = signToken(testUserIdStr);
      const req = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jdRawText: 'We are seeking a Staff Engineer with 8+ years experience in distributed systems and cloud infrastructure.',
          tone: 'warm_professional',
        }),
      });

      const res = await postGenerate(req);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, 'profile_incomplete');
      assert.equal(body.code, 'PROFILE_INCOMPLETE');
      assert.ok(body.message.includes('complete your profile'));
      assert.ok(body.missing_fields.length > 0);
    });
  });
});
