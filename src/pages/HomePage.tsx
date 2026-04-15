import React, { useEffect, useState } from 'react';
import { useHeadscaleStore } from '../store/headscaleStore';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import '../styles/Pages.css';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { fetchUsers, fetchNodes } = useHeadscaleStore();
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.role === 'super_admin';
  const manageableDomains: string[] = (authUser as any)?.manageable_domains || [];

  const [stats, setStats] = useState({ totalUsers: 0, totalNodes: 0, onlineNodes: 0, offlineNodes: 0, activeKeys: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([fetchUsers(), fetchNodes()]);
        const [nodesResp, usersResp, keysResp] = await Promise.all([
          axios.get('/admin/api/headscale/api/v1/node'),
          axios.get('/admin/api/headscale/api/v1/user'),
          axios.get('/admin/api/headscale/api/v1/apikey').catch(() => ({ data: { apiKeys: [] } }))
        ]);
        const allNodes = nodesResp.data.nodes || [];
        const allUsers = usersResp.data.users || [];
        const allKeys = keysResp.data.apiKeys || [];
        const mappingResp = await axios.get('/admin/api/headscale/user-mapping').catch(() => ({ data: {} }));
        const emailMap = mappingResp.data || {};

        const filterByDomain = (email: string) =>
          isSuperAdmin || manageableDomains.some((d: string) => email?.endsWith(d.replace('@', '')));

        const visibleUsers = allUsers.filter((u: any) => {
          const email = u.email || emailMap[u.name] || '';
          return filterByDomain(email);
        });

        const visibleNodes = allNodes.filter((n: any) => {
          const email = n.user?.email || emailMap[n.user?.name] || '';
          return filterByDomain(email);
        });

        setStats({
          totalUsers: visibleUsers.length,
          totalNodes: visibleNodes.length,
          onlineNodes: visibleNodes.filter((n: any) => n.online).length,
          offlineNodes: visibleNodes.filter((n: any) => !n.online).length,
          activeKeys: allKeys.filter((k: any) => new Date(k.expiration) > new Date()).length
        });
      } catch (e) {
        console.error('Failed to load stats:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards = [
    { title: 'Users', icon: '👤', path: '/users', border: 'border-blue-700', stat: stats.totalUsers, statLabel: 'total', show: true },
    { title: 'Nodes', icon: '🖥️', path: '/nodes', border: 'border-purple-700', stat: stats.onlineNodes, statLabel: `online / ${stats.totalNodes}`, show: true },
    { title: 'Routes', icon: '🛣️', path: '/routes', border: 'border-green-700', show: isSuperAdmin },
    { title: 'ACL Editor', icon: '📋', path: '/acl', border: 'border-orange-700', show: true },
    { title: 'DNS', icon: '🌐', path: '/dns', border: 'border-red-700', show: isSuperAdmin },
    { title: 'Settings', icon: '⚙️', path: '/settings', border: 'border-gray-700', show: isSuperAdmin },
  ].filter(c => c.show);

  return (
    <div className="page-container">

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Users', value: stats.totalUsers, color: '#3b82f6' },
          { label: 'Nodes Online', value: stats.onlineNodes, color: '#10b981' },
          { label: 'Nodes Offline', value: stats.offlineNodes, color: '#ef4444' },
          ...(isSuperAdmin ? [{ label: 'Active API Keys', value: stats.activeKeys, color: '#f59e0b' }] : []),
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: '120px', padding: '1rem', backgroundColor: '#1f2937', borderRadius: '0.5rem', border: `1px solid #374151`, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: s.color }}>{loading ? '...' : s.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Navigation cards */}
      <div className="summary-grid">
        {cards.map(card => (
          <div key={card.title} className={`summary-card border-l-4 ${card.border}`}
            onClick={() => card.path && navigate(card.path)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' && card.path) navigate(card.path); }}
            style={{ cursor: 'pointer' }}>
            <div className="summary-icon-large">{card.icon}</div>
            <div className="summary-title-bold">{card.title}</div>
            {card.stat !== undefined && (
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f3f4f6' }}>{card.stat}</span> {card.statLabel}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
