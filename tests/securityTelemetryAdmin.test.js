import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

// Mock DB collections
let mockUsers = [];
let mockCreditTransactions = [];
let mockGenerations = [];
let mockGenerationCostLogs = [];
let mockExternalApiLogs = [];

const regularUserId = new ObjectId('660000000000000000000002');
const adminUserId = new ObjectId('660000000000000000000003');

mockUsers = [
  {
    _id: regularUserId,
    email: 'regular@example.com',
    emailVerified: true,
    is_admin: false,
    free_credits: 5,
    purchased_credits: 0,
    free_credits_granted: true,
    deletion_status: null,
    created_at: new Date(),
  },
  {
    _id: adminUserId,
    email: 'admin@wavyai.in',
    emailVerified: true,
    is_admin: true,
    free_credits: 50,
    purchased_credits: 0,
    free_credits_granted: true,
    deletion_status: null,
    created_at: new Date(),
  },
];

globalThis.__jdOutreachMongoClientPromise = Promise.resolve({
  db: () => ({
    collection: (name) => {
      if (name === 'users') {
        return {
          findOne: async (q) => {
            if (q._id) {
              return mockUsers.find((u) => u._id.toString() === q._id.toString()) || null;
            }
            if (q.email) {
              return mockUsers.find((u) => u.email === q.email) || null;
            }
            return mockUsers[0] || null;
          },
          findOneAndUpdate: async (filter, update, options) => {
            const user = mockUsers.find((u) => {
              if (filter._id && u._id.toString() !== filter._id.toString()) return false;
              if (filter.free_credits?.$gte !== undefined && (u.free_credits || 0) < filter.free_credits.$gte) return false;
              if (filter.purchased_credits?.$gte !== undefined && (u.purchased_credits || 0) < filter.purchased_credits.$gte) return false;
              if (filter.free_credits_granted?.$ne !== undefined && u.free_credits_granted === true) return false;
              return true;
            });
            if (!user) return null;
            if (update.$inc) {
              for (const [k, v] of Object.entries(update.$inc)) {
                user[k] = (user[k] || 0) + v;
              }
            }
            if (update.$set) {
              Object.assign(user, update.$set);
            }
            return user;
          },
          updateOne: async (q, u) => {
            const user = mockUsers.find((usr) => usr._id.toString() === q._id?.toString());
            if (user) {
              if (u.$inc) {
                for (const [k, v] of Object.entries(u.$inc)) {
                  user[k] = (user[k] || 0) + v;
                }
              }
              if (u.$set) Object.assign(user, u.$set);
              return { matchedCount: 1 };
            }
            return { matchedCount: 0 };
          },
          countDocuments: async () => mockUsers.length,
          find: (filter = {}) => {
            const matches = mockUsers.filter((u) => {
              if (filter.device_fingerprint && u.device_fingerprint !== filter.device_fingerprint) return false;
              if (filter._id?.$ne && u._id.toString() === filter._id.$ne.toString()) return false;
              if (filter._id?.$in && !filter._id.$in.some((id) => id.toString() === u._id.toString())) return false;
              return true;
            });
            return {
              project: () => ({
                toArray: async () => matches,
              }),
              sort: () => ({
                skip: () => ({
                  limit: () => ({
                    toArray: async () => matches,
                  }),
                }),
              }),
            };
          },
          createIndex: async () => {},
        };
      }
      if (name === 'credit_transactions') {
        return {
          insertOne: async (doc) => {
            mockCreditTransactions.push(doc);
            return { insertedId: new ObjectId() };
          },
          find: () => ({
            sort: () => ({
              limit: () => ({
                toArray: async () => mockCreditTransactions,
              }),
            }),
          }),
          countDocuments: async () => mockCreditTransactions.length,
          createIndex: async () => {},
        };
      }
      if (name === 'generations') {
        return {
          countDocuments: async () => mockGenerations.length,
          find: () => ({
            sort: () => ({
              skip: () => ({
                limit: () => ({
                  toArray: async () => mockGenerations,
                }),
              }),
            }),
          }),
          aggregate: () => ({
            toArray: async () => [{ _id: regularUserId.toString(), count: 2 }],
          }),
          createIndex: async () => {},
        };
      }
      if (name === 'generation_cost_logs') {
        return {
          aggregate: () => ({
            toArray: async () => [
              {
                _id: null,
                totalCostUsd: 0.125,
                totalLlmCostUsd: 0.08,
                totalTavilyCostUsd: 0.03,
                totalTinyfishCostUsd: 0.015,
                totalLatencyMs: 4500,
                count: 5,
              },
            ],
          }),
          find: () => ({
            sort: () => ({
              skip: () => ({
                limit: () => ({
                  toArray: async () => [
                    {
                      _id: new ObjectId(),
                      generation_id: 'gen_123',
                      user_id: regularUserId.toString(),
                      status: 'completed',
                      total_latency_ms: 3200,
                      costs: { total_generation_cost_usd: 0.025, llm: { cost_usd: 0.015 }, tavily: { cost_usd: 0.005 }, tinyfish: { cost_usd: 0.005 } },
                      created_at: new Date(),
                    },
                  ],
                }),
              }),
            }),
          }),
          countDocuments: async () => 1,
          createIndex: async () => {},
        };
      }
      return {
        find: () => ({
          sort: () => ({
            limit: () => ({
              toArray: async () => [],
            }),
          }),
        }),
        countDocuments: async () => 0,
        createIndex: async () => {},
        insertOne: async () => {},
      };
    },
  }),
});

import {
  FREE_CREDITS,
  getUserCredits,
  reserveGenerationCredit,
  confirmGenerationCredit,
  refundGenerationCredit,
} from '../lib/server/services/credits.js';
import { requireAdminUser, signToken } from '../lib/server/auth.js';
import { rateLimit } from '../lib/server/rateLimit.js';
import { recordAndCheckFingerprint } from '../lib/server/services/fingerprint.js';
import { GET as adminOverviewGet } from '../app/api/admin/overview/route.js';
import { GET as adminUsersGet } from '../app/api/admin/users/route.js';
import { GET as adminCostsGet } from '../app/api/admin/costs/route.js';
import { GET as creditsGet } from '../app/api/credits/route.js';

describe('Security, Telemetry & Admin Functionality Suite', () => {
  // 1. Credit Allocation and Idempotency
  describe('1. Credit Initialization & Rules', () => {
    it('initializes new user with exactly FREE_CREDITS (default 5)', async () => {
      assert.equal(FREE_CREDITS, 5);
      const credits = await getUserCredits(regularUserId.toString());
      assert.equal(credits.freeCredits, 5);
      assert.equal(credits.purchasedCredits, 0);
      assert.equal(credits.totalCredits, 5);
    });

    it('does not re-grant welcome free credits on subsequent lookups', async () => {
      const credits1 = await getUserCredits(regularUserId.toString());
      const credits2 = await getUserCredits(regularUserId.toString());
      assert.equal(credits1.totalCredits, credits2.totalCredits);
    });
  });

  // 2. Credit Reservation, Consumption & Refund
  describe('2. Credit Reservation, Consumption & Refund', () => {
    it('successfully reserves 1 credit atomically when balance exists', async () => {
      const res = await reserveGenerationCredit({ userId: regularUserId.toString() });
      assert.equal(res.success, true);
      assert.equal(res.creditSource, 'free');
      assert.equal(res.freeCredits, 4);
    });

    it('confirms consumption of reserved credit and writes transaction log', async () => {
      await confirmGenerationCredit({
        userId: regularUserId.toString(),
        generationId: 'mock_gen_001',
        reservation: { creditSource: 'free' },
      });

      const genTx = mockCreditTransactions.find((t) => t.type === 'generation');
      assert.ok(genTx);
      assert.equal(genTx.amount, -1);
    });

    it('refunds reserved credit if generation encounters an error', async () => {
      const reservation = await reserveGenerationCredit({ userId: regularUserId.toString() });
      assert.equal(reservation.freeCredits, 3);

      const refundResult = await refundGenerationCredit({
        userId: regularUserId.toString(),
        generationId: 'mock_gen_002',
        reservation,
        reason: 'bedrock_timeout',
      });

      assert.equal(refundResult.freeCredits, 4);
      const refundTx = mockCreditTransactions.find((t) => t.type === 'refund');
      assert.ok(refundTx);
      assert.equal(refundTx.amount, 1);
    });

    it('rejects generation and returns NO_CREDITS when balance is 0', async () => {
      const zeroUserId = new ObjectId('660000000000000000000009');
      mockUsers.push({
        _id: zeroUserId,
        email: 'broke@example.com',
        emailVerified: true,
        free_credits: 0,
        purchased_credits: 0,
        free_credits_granted: true,
      });

      const res = await reserveGenerationCredit({ userId: zeroUserId.toString() });
      assert.equal(res.success, false);
      assert.equal(res.code, 'NO_CREDITS');
      assert.equal(res.totalCredits, 0);
    });
  });

  // 3. Admin Authentication & Role Protection
  describe('3. Admin Authentication & Protection', () => {
    it('rejects non-admin user with 403 Forbidden', async () => {
      const regularToken = signToken(regularUserId.toString());
      const req = new Request('http://localhost:3000/api/admin/overview', {
        headers: { Authorization: `Bearer ${regularToken}` },
      });

      await assert.rejects(
        async () => requireAdminUser(req),
        (err) => {
          assert.equal(err.status, 403);
          assert.equal(err.message, 'admin_access_required');
          return true;
        }
      );
    });

    it('allows verified admin user with is_admin: true', async () => {
      const adminToken = signToken(adminUserId.toString());
      const req = new Request('http://localhost:3000/api/admin/overview', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const { user } = await requireAdminUser(req);
      assert.ok(user);
      assert.equal(user.email, 'admin@wavyai.in');
      assert.equal(user.is_admin, true);
    });

    it('admin overview endpoint returns valid aggregated metrics', async () => {
      const adminToken = signToken(adminUserId.toString());
      const req = new Request('http://localhost:3000/api/admin/overview', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const res = await adminOverviewGet(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.summary);
      assert.ok(body.summary.total_users >= 2);
    });

    it('admin users endpoint sanitizes outputs and excludes sensitive password hashes', async () => {
      const adminToken = signToken(adminUserId.toString());
      const req = new Request('http://localhost:3000/api/admin/users', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const res = await adminUsersGet(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.users));
      for (const u of body.users) {
        assert.equal(u.password_hash, undefined);
        assert.equal(u.emailVerificationTokenHash, undefined);
      }
    });
  });

  // 4. Rate Limiting & Fingerprinting
  describe('4. Rate Limiting & Fingerprinting', () => {
    it('rate limits burst requests based on IP and keyPrefix', () => {
      const mockReq = new Request('http://localhost:3000/api/generate', {
        headers: { 'x-forwarded-for': '203.0.113.195' },
      });

      let lastResult;
      for (let i = 0; i < 5; i++) {
        lastResult = rateLimit(mockReq, { limit: 3, windowMs: 60000, keyPrefix: 'test_limit' });
      }

      assert.equal(lastResult.success, false);
      assert.equal(lastResult.remaining, 0);
      assert.ok(lastResult.retryAfter > 0);
    });

    it('records device fingerprint and flags repeat devices across accounts', async () => {
      const result1 = await recordAndCheckFingerprint({
        userId: regularUserId.toString(),
        fingerprint: 'fp_abc123',
      });
      assert.equal(result1.flagged, false);

      const anotherUserId = new ObjectId('660000000000000000000010');
      mockUsers.push({
        _id: anotherUserId,
        email: 'another@example.com',
        emailVerified: true,
      });

      const result2 = await recordAndCheckFingerprint({
        userId: anotherUserId.toString(),
        fingerprint: 'fp_abc123',
      });
      assert.equal(result2.flagged, true);
      assert.equal(result2.fingerprintCount, 2);
    });
  });

  // 5. User Credits Endpoint
  describe('5. GET /api/credits Endpoint', () => {
    it('returns authenticated user credit balance', async () => {
      const token = signToken(regularUserId.toString());
      const req = new Request('http://localhost:3000/api/credits', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await creditsGet(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(typeof data.freeCredits, 'number');
      assert.equal(typeof data.purchasedCredits, 'number');
      assert.equal(typeof data.totalCredits, 'number');
    });
  });
});
