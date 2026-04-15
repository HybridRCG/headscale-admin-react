/* eslint-disable @typescript-eslint/no-unused-vars */
import { useAuthStore } from '../store/authStore';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/Pages.css';

interface Node {
  id: string;
  name: string;
  approvedRoutes: string[];
  availableRoutes: string[];
}

export const RoutesPage: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const { user: authUser } = useAuthStore();
  const manageableDomains: string[] = (authUser as any)?.manageable_domains || [];
  const shouldFilter = authUser?.role !== 'super_admin' && !manageableDomains.includes('*');
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string>('');

  useEffect(() => { fetchRoutes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/api/headscale/api/v1/node');
      const allNodes = response.data.nodes || [];
      const nodesWithRoutes = allNodes.filter((node: any) =>
        (!shouldFilter || manageableDomains.some((d: string) => (node as any).user?.email?.endsWith(d.replace('@', '')))) &&
        node.availableRoutes && node.availableRoutes.length > 0
      );
      setNodes(nodesWithRoutes);
    } catch (error) {
      console.error('Failed to fetch routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRoute = async (nodeId: string, route: string, isApproved: boolean) => {
    setApproving(`${nodeId}-${route}`);
    try {
      if (isApproved) {
        await axios.post('/admin/api/headscale/disapprove-route', { nodeId, route });
      } else {
        await axios.post('/admin/api/headscale/approve-route', { nodeId, route });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchRoutes();
    } catch (error) {
      alert('Failed to update route.');
    } finally {
      setApproving('');
    }
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={fetchRoutes} disabled={loading}>🔄 Refresh</button>
        {!loading && <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{nodes.length} node{nodes.length !== 1 ? 's' : ''} with routes</span>}
      </div>

      {loading ? (
        <div className="loading">Loading routes...</div>
      ) : nodes.length === 0 ? (
        <div className="no-results">No nodes with advertised routes found</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', color: '#d1d5db' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #374151' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#f3f4f6' }}>Node</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#f3f4f6' }}>Route</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#f3f4f6' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#f3f4f6' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map(node =>
                node.availableRoutes.map((route, ridx) => {
                  const isApproved = node.approvedRoutes?.includes(route);
                  const isApproving = approving === `${node.id}-${route}`;
                  return (
                    <tr key={`${node.id}-${route}`} style={{ borderBottom: '1px solid #1f2937', backgroundColor: ridx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      {ridx === 0 && (
                        <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'top', fontWeight: '600', color: '#f3f4f6' }} rowSpan={node.availableRoutes.length}>
                          <div>{node.name}</div>
                          <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: '400' }}>ID: {node.id}</div>
                        </td>
                      )}
                      <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', color: '#93c5fd' }}>{route}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <span style={{ color: isApproved ? '#10b981' : '#f59e0b', fontWeight: '600', fontSize: '0.8rem' }}>
                          {isApproved ? '✓ Approved' : '⏳ Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <button
                          className={`btn btn-sm ${isApproved ? 'btn-error' : 'btn-primary'}`}
                          onClick={() => handleToggleRoute(node.id, route, !!isApproved)}
                          disabled={isApproving}
                          style={{ opacity: isApproving ? 0.5 : 1, minWidth: '90px' }}
                        >
                          {isApproving ? '...' : isApproved ? 'Disapprove' : 'Approve'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
