import React, { useEffect, useState } from 'react';
import { useHeadscaleStore } from '../store/headscaleStore';
import '../styles/Pages.css';

export const NodesPage: React.FC = () => {
  const { nodes, fetchNodes, isLoading } = useHeadscaleStore();

  useEffect(() => {
    fetchNodes();
  }, []);

  if (isLoading && nodes.length === 0) {
    return (
      <div className="page-container">
        <h1 className="page-title">Nodes</h1>
        <div className="loading">Loading nodes...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">Nodes</h1>

      {nodes.length === 0 ? (
        <div className="no-results">No nodes found</div>
      ) : (
        <div className="users-grid">
          {nodes.map((node) => (
            <div key={node.id} className="user-card">
              <div className="user-header">
                <div className="user-status">
                  <span className={`status-badge ${node.online ? 'online' : 'offline'}`}>
                    {node.online ? '🟢' : '🔴'}
                  </span>
                </div>
                <h3 className="user-name">{node.name}</h3>
              </div>
              <div className="user-info">
                <div className="info-row">
                  <span className="info-label">ID:</span>
                  <span className="info-value">{node.id}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">User:</span>
                  <span className="info-value">{node.user.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">IPs:</span>
                  <span className="info-value">{node.ipAddresses.join(', ')}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Last Seen:</span>
                  <span className="info-value">{new Date(node.lastSeen).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
