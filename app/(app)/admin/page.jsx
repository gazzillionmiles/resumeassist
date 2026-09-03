'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/state/authStore';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  ShieldAlert,
  Users,
  Activity,
  DollarSign,
  CreditCard,
  FileCode,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';

export default function AdminPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'activity' | 'costs' | 'payment_wall' | 'logs'
  const [userSearch, setUserSearch] = useState('');

  // 1. Overview Query
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['admin_overview'],
    queryFn: api.getAdminOverview,
    enabled: Boolean(user?.is_admin),
  });

  // 2. Users Query
  const {
    data: usersData,
    isLoading: isUsersLoading,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin_users', userSearch],
    queryFn: () => api.getAdminUsers({ q: userSearch }),
    enabled: Boolean(user?.is_admin && activeTab === 'users'),
  });

  // 3. Activity Query
  const {
    data: activityData,
    isLoading: isActivityLoading,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ['admin_activity'],
    queryFn: api.getAdminActivity,
    enabled: Boolean(user?.is_admin && activeTab === 'activity'),
  });

  // 4. Costs Query
  const {
    data: costsData,
    isLoading: isCostsLoading,
    refetch: refetchCosts,
  } = useQuery({
    queryKey: ['admin_costs'],
    queryFn: api.getAdminCosts,
    enabled: Boolean(user?.is_admin && activeTab === 'costs'),
  });

  // 5. Payment Wall Query
  const {
    data: paymentWallData,
    isLoading: isPaymentWallLoading,
    refetch: refetchPaymentWall,
  } = useQuery({
    queryKey: ['admin_payment_wall'],
    queryFn: api.getAdminPaymentWall,
    enabled: Boolean(user?.is_admin && activeTab === 'payment_wall'),
  });

  // 6. Logs Query
  const {
    data: logsData,
    isLoading: isLogsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['admin_logs'],
    queryFn: api.getAdminLogs,
    enabled: Boolean(user?.is_admin && activeTab === 'logs'),
  });

  if (!user?.is_admin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white">Administrator Access Required</h1>
        <p className="text-xs text-zinc-400 max-w-sm">
          You do not have permission to view the administrative console. This attempt has been logged.
        </p>
        <Link href="/generate" className="btn-primary text-xs py-2 px-4 mt-2">
          Return to Outreach
        </Link>
      </div>
    );
  }

  const summary = overviewData?.summary;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2CB7A5] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#2CB7A5] font-bold">
              Operational Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">Admin Dashboard</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'overview') refetchOverview();
              else if (activeTab === 'users') refetchUsers();
              else if (activeTab === 'activity') refetchActivity();
              else if (activeTab === 'costs') refetchCosts();
              else if (activeTab === 'payment_wall') refetchPaymentWall();
              else if (activeTab === 'logs') refetchLogs();
            }}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-white/10 text-xs font-medium">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'activity', label: 'Activity', icon: Activity },
          { id: 'costs', label: 'Costs & Economics', icon: DollarSign },
          { id: 'payment_wall', label: 'Payment Wall', icon: CreditCard },
          { id: 'logs', label: 'Logs', icon: FileCode },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-2 px-3.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#2CB7A5] text-[#121316] font-bold shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {isOverviewLoading ? (
            <div className="py-20 flex justify-center items-center text-zinc-500 text-xs gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading system overview…</span>
            </div>
          ) : (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Total Accounts</span>
                    <Users className="w-4 h-4 text-[#2CB7A5]" />
                  </div>
                  <p className="text-2xl font-bold text-white font-mono">{summary?.total_users || 0}</p>
                  <p className="text-[11px] text-zinc-500">Registered users in database</p>
                </div>

                <div className="glass-card p-5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Total Generations</span>
                    <Activity className="w-4 h-4 text-[#2CB7A5]" />
                  </div>
                  <p className="text-2xl font-bold text-white font-mono">{summary?.total_generations || 0}</p>
                  <p className="text-[11px] text-[#2CB7A5] font-mono">
                    +{summary?.generations_last_24h || 0} in past 24h
                  </p>
                </div>

                <div className="glass-card p-5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Total Estimated Cost</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-white font-mono">
                    ${summary?.total_estimated_cost_usd || 0}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Avg: ${summary?.average_cost_per_generation_usd || 0} / gen
                  </p>
                </div>

                <div className="glass-card p-5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Zero Credit Users</span>
                    <CreditCard className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-white font-mono">{summary?.zero_credit_users || 0}</p>
                  <p className="text-[11px] text-zinc-500">Reached payment wall limit</p>
                </div>
              </div>

              {/* Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-5 border border-white/10 space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Infrastructure Cost Breakdown
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-zinc-400">LLM Inference:</span>
                      <span className="font-mono text-white font-semibold">
                        ${summary?.cost_breakdown?.llm_usd || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-zinc-400">Search Intelligence:</span>
                      <span className="font-mono text-white font-semibold">
                        ${summary?.cost_breakdown?.tavily_usd || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-zinc-400">Web &amp; Document Fetch:</span>
                      <span className="font-mono text-white font-semibold">
                        ${summary?.cost_breakdown?.tinyfish_usd || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 font-bold text-white">
                      <span>Total Cumulative Cost:</span>
                      <span className="font-mono text-[#2CB7A5]">
                        ${summary?.total_estimated_cost_usd || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-5 border border-white/10 space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    System Health &amp; Pipeline Stats
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-zinc-400">Average Pipeline Latency:</span>
                      <span className="font-mono text-white font-semibold">
                        {summary?.average_latency_seconds || 0}s
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-zinc-400">Total Credits Consumed:</span>
                      <span className="font-mono text-white font-semibold">
                        {summary?.total_credits_consumed || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-zinc-400">Security / Fingerprint Active:</span>
                      <span className="text-[#2CB7A5] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Enabled</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search users by email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="input-field pl-9 text-xs py-2"
              />
            </div>
          </div>

          {isUsersLoading ? (
            <div className="py-16 flex justify-center text-zinc-500 text-xs">Loading users…</div>
          ) : (
            <div className="glass-card overflow-x-auto border border-white/10 rounded-2xl">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-white/10">
                  <tr>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Credits</th>
                    <th className="p-3.5">Generations</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Device FP</th>
                    <th className="p-3.5">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {(usersData?.users || []).map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="p-3.5 font-sans font-medium text-white flex items-center gap-2">
                        <span>{u.email}</span>
                        {u.is_admin && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[9px] border border-amber-500/20">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className={u.total_credits === 0 ? 'text-red-400 font-bold' : 'text-[#2CB7A5]'}>
                          {u.total_credits}
                        </span>{' '}
                        <span className="text-zinc-500 text-[10px]">({u.free_credits} free / {u.purchased_credits} pur)</span>
                      </td>
                      <td className="p-3.5 text-zinc-300">{u.generations_count}</td>
                      <td className="p-3.5">
                        {u.deletion_status === 'pending_deletion' ? (
                          <span className="text-amber-400 text-[10px]">Pending Deletion</span>
                        ) : u.email_verified ? (
                          <span className="text-emerald-400 text-[10px]">Verified</span>
                        ) : (
                          <span className="text-zinc-500 text-[10px]">Unverified</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {u.fingerprint_flagged ? (
                          <span className="text-red-400 text-[10px] font-sans">
                            ⚠️ Shared ({u.fingerprint_count})
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-[10px] font-sans">Normal</span>
                        )}
                      </td>
                      <td className="p-3.5 text-zinc-500 font-sans">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {usersData?.users?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500 font-sans">
                        No users found matching query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {isActivityLoading ? (
            <div className="py-16 flex justify-center text-zinc-500 text-xs">Loading activity…</div>
          ) : (
            <div className="glass-card overflow-x-auto border border-white/10 rounded-2xl">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-white/10">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Type &amp; Target</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Latency</th>
                    <th className="p-3.5">Cost</th>
                    <th className="p-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {(activityData?.activities || []).map((a) => (
                    <tr key={a.id} className="hover:bg-white/[0.02]">
                      <td className="p-3.5 font-sans text-zinc-300 truncate max-w-[180px]">
                        {a.user_email}
                      </td>
                      <td className="p-3.5 font-sans">
                        <span className="font-semibold text-white">{a.company_name}</span>
                        <span className="text-zinc-500 text-[10px] block uppercase font-mono">
                          {a.generation_type}
                        </span>
                      </td>
                      <td className="p-3.5 font-sans">
                        {a.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400 text-[11px]">
                            <XCircle className="w-3 h-3" />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-zinc-400">
                        {Math.round((a.total_latency_ms / 100) / 10)}s
                      </td>
                      <td className="p-3.5 text-[#2CB7A5] font-bold">
                        ${a.total_cost_usd}
                      </td>
                      <td className="p-3.5 text-zinc-500 font-sans">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {activityData?.activities?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500 font-sans">
                        No activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COSTS */}
      {activeTab === 'costs' && (
        <div className="space-y-6">
          {isCostsLoading ? (
            <div className="py-16 flex justify-center text-zinc-500 text-xs">Loading cost data…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-4 border border-white/10 space-y-1">
                  <span className="text-[11px] text-zinc-400 uppercase">Cumulative Cost</span>
                  <p className="text-xl font-bold font-mono text-white">
                    ${costsData?.overall?.total_cost_usd || 0}
                  </p>
                </div>
                <div className="glass-card p-4 border border-white/10 space-y-1">
                  <span className="text-[11px] text-zinc-400 uppercase">Total Generations</span>
                  <p className="text-xl font-bold font-mono text-white">
                    {costsData?.overall?.total_generations || 0}
                  </p>
                </div>
                <div className="glass-card p-4 border border-white/10 space-y-1">
                  <span className="text-[11px] text-zinc-400 uppercase">Average / Gen</span>
                  <p className="text-xl font-bold font-mono text-[#2CB7A5]">
                    ${costsData?.overall?.average_cost_per_generation_usd || 0}
                  </p>
                </div>
              </div>

              <div className="glass-card overflow-x-auto border border-white/10 rounded-2xl space-y-3 p-5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Per-User Cost Attribution (Top Users)
                </h3>
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-white/10">
                    <tr>
                      <th className="p-3">User Email</th>
                      <th className="p-3">Generations</th>
                      <th className="p-3">Total Cost</th>
                      <th className="p-3">Avg / Gen</th>
                      <th className="p-3">LLM Cost</th>
                      <th className="p-3">Search Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {(costsData?.per_user || []).map((u) => (
                      <tr key={u.user_id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-sans text-white">{u.user_email}</td>
                        <td className="p-3 text-zinc-300">{u.total_generations}</td>
                        <td className="p-3 text-emerald-400 font-bold">${u.total_cost_usd}</td>
                        <td className="p-3 text-zinc-400">${u.average_cost_per_generation_usd}</td>
                        <td className="p-3 text-zinc-500">${u.llm_cost_usd}</td>
                        <td className="p-3 text-zinc-500">${u.tavily_cost_usd}</td>
                      </tr>
                    ))}
                    {costsData?.per_user?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-zinc-500 font-sans">
                          No cost records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 5: PAYMENT WALL */}
      {activeTab === 'payment_wall' && (
        <div className="space-y-6">
          {isPaymentWallLoading ? (
            <div className="py-16 flex justify-center text-zinc-500 text-xs">Loading payment wall activity…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card p-5 border border-white/10 space-y-2">
                  <span className="text-xs text-zinc-400">Zero-Credit Accounts</span>
                  <p className="text-2xl font-bold font-mono text-amber-400">
                    {paymentWallData?.total_zero_credit_users || 0}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Users currently blocked by credit depletion
                  </p>
                </div>
                <div className="glass-card p-5 border border-white/10 space-y-2">
                  <span className="text-xs text-zinc-400">Upgrade Intent Clicks</span>
                  <p className="text-2xl font-bold font-mono text-[#2CB7A5]">
                    {paymentWallData?.intent_events?.length || 0}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Users who clicked &quot;Get Credits&quot; on wall
                  </p>
                </div>
              </div>

              <div className="glass-card p-5 border border-white/10 rounded-2xl space-y-3 overflow-x-auto">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Zero-Credit Users Waiting for Upgrade
                </h3>
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-white/10">
                    <tr>
                      <th className="p-3">User Email</th>
                      <th className="p-3">Credits</th>
                      <th className="p-3">Created Date</th>
                      <th className="p-3">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {(paymentWallData?.zero_credit_users || []).map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-sans text-white">{u.email}</td>
                        <td className="p-3 text-red-400 font-bold">0 credits</td>
                        <td className="p-3 text-zinc-500 font-sans">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="p-3 text-zinc-400 font-sans">{new Date(u.last_active).toLocaleString()}</td>
                      </tr>
                    ))}
                    {paymentWallData?.zero_credit_users?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-zinc-500 font-sans">
                          No zero-credit users at this time.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 6: LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {isLogsLoading ? (
            <div className="py-16 flex justify-center text-zinc-500 text-xs">Loading logs…</div>
          ) : (
            <div className="glass-card overflow-x-auto border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Recent API Logs &amp; Operations
              </h3>
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">Operation</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Latency</th>
                    <th className="p-3">Error (if any)</th>
                    <th className="p-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {(logsData?.api_logs || []).map((l) => (
                    <tr key={l.id} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-sans text-white font-medium">
                        {l.operation} <span className="text-[10px] text-zinc-500 font-mono">({l.provider})</span>
                      </td>
                      <td className="p-3 font-sans">
                        {l.status === 'success' ? (
                          <span className="text-emerald-400 text-[10px]">Success</span>
                        ) : (
                          <span className="text-red-400 text-[10px]">Error</span>
                        )}
                      </td>
                      <td className="p-3 text-zinc-400">{l.latency_ms}ms</td>
                      <td className="p-3 text-red-300 font-sans text-[11px] truncate max-w-xs">
                        {l.error_message || '—'}
                      </td>
                      <td className="p-3 text-zinc-500 font-sans">
                        {new Date(l.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                  {logsData?.api_logs?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-zinc-500 font-sans">
                        No logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
