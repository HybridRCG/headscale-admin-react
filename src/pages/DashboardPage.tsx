import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { headscaleApi, initializeApiClient } from '../services/api';
import { Node } from '../types';
import '../styles/DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      initializeApiClient();
      const nodesData = await headscaleApi.getNodes();
      setNodes(nodesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Headscale Admin</h1>
        <div className="header-right">
          {user && <span className="user-info">{user.name} ({user.role})</span>}
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <h2>Nodes</h2>

        {loading && <p>Loading...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && nodes.length > 0 && (
          <div className="nodes-list">
            {nodes.map((node) => (
              <div key={node.id} className="node-card">
                <h3>{node.givenName}</h3>
                <p>
                  <strong>User:</strong> {node.user?.name}
                </p>
                <p>
                  <strong>IPs:</strong> {node.ipAddresses?.join(', ')}
                </p>
                <p>
                  <strong>Status:</strong>{' '}
                  <span className={node.online ? 'online' : 'offline'}>
                    {node.online ? '🟢 Online' : '🔴 Offline'}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}

        {!loading && nodes.length === 0 && <p>No nodes found</p>}
      </main>
    </div>
  );
};
