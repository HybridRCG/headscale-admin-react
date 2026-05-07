/* eslint-disable @typescript-eslint/no-unused-vars */
import { useAuthStore } from '../store/authStore';
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import '../styles/Pages.css';

// ─────────────────────────────────────────────────────────────────────────────
// Routes Page (block layout — mirrors NodesPage card design)
//
// Each card represents one node that advertises subnet routes. Per route the
// card shows: the CIDR, whether it's approved, and (for approved routes) whether
// this node is the primary serving it. Actions per route: approve / disapprove.
//
// We compute "primary" client-side: a node is primary for a route iff it is the
// only approved+online node for that route. This matches Headscale's actual
// runtime selection closely enough for diagnostic purposes — the UI's purpose
// is to surface "no primary serving" situations like the 192.168.1.0/24 outage
// we hit on 2026-05-07.
// ─────────────────────────────────────────────────────────────────────────────

interface Node {
  id: string;
  name: string;
  hostname?: string;
  online?: boolean;
  ipAddresses?: string[];
  user?: { name: string; email?: string };
  approvedRoutes?: string[];
  availableRoutes?: string[];
  forcedTags?: string[];
  validTags?: string[];
}

type FilterMode = 'all' | 'approved' | 'pending' | 'no-primary';

const fmtRoute = (r: string) => r;

export const RoutesPage: React.FC = () => {
  const { user: authUser } = useAuthStore();
  const manageableDomains: string[] = (authUser as any)?.manageable_domains || [];
  const shouldFilter = authUser?.role !== 'super_admin' && !manageableDomains.includes('*');

  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [busyKey, setBusyKey] = useState<string>(''); // `${nodeId}::${route}` while in-flight

  useEffect(() => { fetchRoutes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const r = await axios.get('/admin/api/headscale/api/v1/node');
      const all: any[] = r.data.nodes || [];
      const filtered = all.filter(n => {
        const hasRoutes = (n.availableRoutes && n.availableRoutes.length > 0) ||
                          (n.approvedRoutes && n.approvedRoutes.length > 0);
        if (!hasRoutes) return false;
        if (!shouldFilter) return true;
        const email: string = n.user?.email || '';
        return manageableDomains.some(d => {
          const dom = d.startsWith('@') ? d.slice(1) : d;
          return email.endsWith(dom);
        });
      });
      setNodes(filtered);
    } catch (e) {
      console.error('Failed to fetch routes:', e);
    } finally {
      setLoading(false);
    }
  };

  // Build a map: route -> list of online+approved nodes serving it.
  // Used to flag "no primary" cases and to render which nodes serve each route.
  const serversByRoute = useMemo(() => {
    const map: Record<string, Node[]> = {};
    nodes.forEach(n => {
      (n.approvedRoutes || []).forEach(r => {
        if (!map[r]) map[r] = [];
        if (n.online) map[r].push(n);
      });
    });
    return map;
  }, [nodes]);

  // A node "has a primary problem" if any of its approved routes has
  // zero online servers. This is the pattern that broke LAN access today.
  const nodeHasPrimaryProblem = (n: Node) =>
    (n.approvedRoutes || []).some(r => (serversByRoute[r] || []).length === 0);

  // Whether THIS node is currently the primary for the given route. Headscale
  // picks one primary per route; here we approximate as "first online approved
  // server" sorted by node id (stable). Good enough for the badge.
  const isPrimaryFor = (n: Node, route: string) => {
    const servers = serversByRoute[route] || [];
    if (servers.length === 0) return false;
    const sorted = [...servers].sort((a, b) => Number(a.id) - Number(b.id));
    return sorted[0].id === n.id;
  };

  const handleToggle = async (n: Node, route: string, isApproved: boolean) => {
    const key = `${n.id}::${route}`;
    setBusyKey(key);
    try {
      const url = isApproved
        ? '/admin/api/headscale/disapprove-route'
        : '/admin/api/headscale/approve-route';
      await axios.post(url, { nodeId: n.id, route });
      // Brief delay so Headscale's primary recompute lands before we refetch
      await new Promise(r => setTimeout(r, 400));
      await fetchRoutes();
    } catch (e: any) {
      alert(`Failed to ${isApproved ? 'disapprove' : 'approve'} route: ` + (e.response?.data?.message || e.message));
    } finally {
      setBusyKey('');
    }
  };

  // Filtering + search
  const visibleNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nodes.filter(n => {
      // Search across node name and route CIDRs
      if (q) {
        const haystack = [n.name, ...(n.availableRoutes || []), ...(n.approvedRoutes || [])]
          .join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      const approved = (n.approvedRoutes || []).length;
      const available = (n.availableRoutes || []).length;
      const pending = available - approved;
      switch (filterMode) {
        case 'approved': return approved > 0;
        case 'pending': return pending > 0;
        case 'no-primary': return nodeHasPrimaryProblem(n);
        default: return true;
      }
    });
  }, [nodes, search, filterMode, serversByRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  const noPrimaryCount = nodes.filter(nodeHasPrimaryProblem).length;

  if (loading) return <div className="page-container"><div className="loading">Loading routes...</div></div>;

  return (
    <div className="page-container">
      {/* ── Toolbar ── */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'approved', 'pending', 'no-primary'] as FilterMode[]).map(f => (
          <button key={f}
            className={`btn ${filterMode === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode(f)}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
            {f === 'all' && 'All'}
            {f === 'approved' && '✓ Approved'}
            {f === 'pending' && '⏳ Pending'}
            {f === 'no-primary' && (
              <span style={{ color: noPrimaryCount > 0 ? '#fbbf24' : undefined }}>
                ⚠ No primary{noPrimaryCount > 0 ? ` (${noPrimaryCount})` : ''}
              </span>
            )}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search node or route..."
          style={{ flex: 1, minWidth: '180px', padding: '0.4rem 0.75rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.85rem' }}
        />
        <button className="btn btn-secondary" onClick={fetchRoutes} disabled={loading}
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
          🔄 Refresh
        </button>
      </div>

      {/* ── No-primary warning banner ── */}
      {filterMode !== 'no-primary' && noPrimaryCount > 0 && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.6rem 0.85rem',
          backgroundColor: '#451a03',
          border: '1px solid #92400e',
          borderRadius: '0.5rem',
          color: '#fde68a',
          fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap',
        }}>
          <span>⚠ {noPrimaryCount} node{noPrimaryCount === 1 ? '' : 's'} have approved routes with no online primary serving them. Traffic for those subnets will silently drop.</span>
          <button className="btn btn-sm" style={{ fontSize: '0.75rem', backgroundColor: '#92400e', color: '#fde68a', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '0.25rem', cursor: 'pointer' }}
            onClick={() => setFilterMode('no-primary')}>Show only these</button>
        </div>
      )}

      {/* ── Card grid ── */}
      {visibleNodes.length === 0 ? (
        <div className="no-results">No nodes match your filters</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
          {visibleNodes.map(n => {
            const approved = n.approvedRoutes || [];
            const available = n.availableRoutes || [];
            // Union of all routes this node touches (advertised + approved)
            const allRoutes = Array.from(new Set([...available, ...approved])).sort();
            const owner = n.user?.name || '—';
            const primaryProblem = nodeHasPrimaryProblem(n);
            return (
              <div key={n.id} style={{
                backgroundColor: '#1f2937',
                border: `1px solid ${primaryProblem ? '#92400e' : n.online ? '#1e3a5f' : '#374151'}`,
                borderRadius: '0.625rem',
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Header */}
                <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid #374151' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>{n.online ? '🟢' : '🔴'}</span>
                      <span style={{ color: '#f3f4f6', fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={n.name}>{n.name}</span>
                    </div>
                    <span style={{ color: '#6b7280', fontSize: '0.68rem', flexShrink: 0, marginLeft: '0.5rem' }}>#{n.id}</span>
                  </div>
                  <div style={{ color: '#60a5fa', fontSize: '0.72rem', fontFamily: 'monospace', marginBottom: '0.15rem' }}>
                    {n.ipAddresses?.[0] || 'No IP'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
                    <div style={{ color: '#8b5cf6', fontSize: '0.72rem', fontWeight: 600 }}>👤 {owner}</div>
                    <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                      {approved.length}/{available.length || approved.length} approved
                    </div>
                  </div>
                </div>

                {/* Routes list */}
                <div style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                  {allRoutes.length === 0 && (
                    <div style={{ color: '#6b7280', fontSize: '0.78rem', padding: '0.5rem 0' }}>No routes</div>
                  )}
                  {allRoutes.map(route => {
                    const isApproved = approved.includes(route);
                    const servers = serversByRoute[route] || [];
                    const primary = isApproved && isPrimaryFor(n, route);
                    const noPrimaryForRoute = isApproved && servers.length === 0;
                    const busy = busyKey === `${n.id}::${route}`;
                    return (
                      <div key={route} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: '0.5rem',
                        padding: '0.45rem 0.55rem',
                        backgroundColor: '#111827',
                        border: `1px solid ${noPrimaryForRoute ? '#92400e' : '#374151'}`,
                        borderRadius: '0.375rem',
                        marginBottom: '0.35rem',
                      }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#93c5fd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={route}>
                            {fmtRoute(route)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 600,
                              color: isApproved ? '#10b981' : '#f59e0b',
                            }}>
                              {isApproved ? '✓ Approved' : '⏳ Pending'}
                            </span>
                            {primary && (
                              <span style={{ fontSize: '0.6rem', backgroundColor: '#064e3b', color: '#34d399', padding: '0.05rem 0.35rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                                ★ PRIMARY
                              </span>
                            )}
                            {isApproved && !primary && servers.length > 1 && (
                              <span style={{ fontSize: '0.6rem', color: '#9ca3af' }} title={servers.map(s => s.name).join(', ')}>
                                ⤷ standby ({servers.length - 1} other{servers.length - 1 === 1 ? '' : 's'})
                              </span>
                            )}
                            {noPrimaryForRoute && (
                              <span style={{ fontSize: '0.6rem', backgroundColor: '#7f1d1d', color: '#fecaca', padding: '0.05rem 0.35rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                                ⚠ NO ONLINE SERVER
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className={`btn btn-sm ${isApproved ? 'btn-error' : 'btn-success'}`}
                          onClick={() => handleToggle(n, route, isApproved)}
                          disabled={busy}
                          style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem', minWidth: '88px', flexShrink: 0, opacity: busy ? 0.5 : 1 }}>
                          {busy ? '...' : isApproved ? 'Disapprove' : 'Approve'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
