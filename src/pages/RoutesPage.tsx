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
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string>('');

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3000/api/headscale/api/v1/node');
      const allNodes = response.data.nodes || [];
      
      const nodesWithRoutes = allNodes.filter((node: any) => 
        (node.approvedRoutes && node.approvedRoutes.length > 0) ||
        (node.availableRoutes && node.availableRoutes.length > 0)
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
        await axios.post('http://localhost:3000/api/headscale/disapprove-route', { nodeId, route });
      } else {
        await axios.post('http://localhost:3000/api/headscale/approve-route', { nodeId, route });
      }
      
      // Wait a moment for the backend to update, then refetch
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchRoutes();
    } catch (error) {
      console.error('Failed to toggle route:', error);
      alert('Failed to update route. Check console for details.');
    } finally {
      setApproving('');
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Routes</h1>

      <div style={{ marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={fetchRoutes} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading routes...</div>
      ) : nodes.length === 0 ? (
        <div className="no-results">No routes found</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1.5rem',
        }}>
          {nodes.map((node) => (
            <div
              key={node.id}
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '0.5rem',
                padding: '1.5rem',
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#f3f4f6' }}>
                  {node.name}
                </h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', fontWeight: '400' }}>ID: {node.id}</p>
              </div>

              <div>
                <p style={{ margin: '0.75rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#d1d5db' }}>
                  Routes:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {node.availableRoutes && node.availableRoutes.length > 0 ? (
                    node.availableRoutes.map((route) => {
                      const isApproved = node.approvedRoutes?.includes(route);
                      const isApproving = approving === `${node.id}-${route}`;
                      return (
                        <div
                          key={route}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: '#374151',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            color: '#f3f4f6',
                          }}
                        >
                          <span style={{ fontFamily: 'monospace', flex: 1 }}>{route}</span>
                          <div
                            onClick={() => handleToggleRoute(node.id, route, isApproved)}
                            style={{
                              width: '20px',
                              height: '12px',
                              backgroundColor: isApproved ? '#86efac' : '#ef5350',
                              borderRadius: '6px',
                              cursor: isApproving ? 'not-allowed' : 'pointer',
                              opacity: isApproving ? 0.5 : 1,
                              transition: 'all 0.2s',
                            }}
                            title={isApproved ? 'Click to disapprove' : 'Click to approve'}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>No routes</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
