import React, { useEffect } from 'react';
import { useHeadscaleStore } from '../store/headscaleStore';
import { useNavigate } from 'react-router-dom';
import '../styles/Pages.css';

interface SummaryCard {
  title: string;
  value: number;
  border: string;
  icon: string;
  path: string;
}

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { users, nodes, preAuthKeys, fetchUsers, fetchNodes, fetchPreAuthKeys, isLoading } =
    useHeadscaleStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([fetchUsers(), fetchNodes(), fetchPreAuthKeys()]);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };

    fetchData();
  }, []);

  const onlineUsers = users.filter((user) =>
    nodes.some((node) => node.online && node.user.id === user.id)
  ).length;

  const validPreAuthKeys = preAuthKeys.filter((key) => {
    const isExpired = new Date(key.expiration) < new Date();
    const isUsed = key.used && !key.reusable;
    return !isExpired && !isUsed;
  }).length;

  const onlineNodes = nodes.filter((n) => n.online).length;

  const totalRoutes = nodes.reduce(
    (acc, node) => acc + (node.availableRoutes?.length || 0),
    0
  );

  const summaries: SummaryCard[] = [
    {
      title: 'Total Users',
      value: users.length,
      border: 'border-blue-700',
      icon: '👤',
      path: '/users',
    },
    {
      title: 'Online Users',
      value: onlineUsers,
      border: 'border-blue-500',
      icon: '👤',
      path: '/users',
    },
    {
      title: 'Valid PreAuth Keys',
      value: validPreAuthKeys,
      border: 'border-slate-700',
      icon: '🔑',
      path: '/users',
    },
    {
      title: 'Total Nodes',
      value: nodes.length,
      border: 'border-purple-700',
      icon: '🖥️',
      path: '/nodes',
    },
    {
      title: 'Online Nodes',
      value: onlineNodes,
      border: 'border-purple-400',
      icon: '🖥️',
      path: '/nodes',
    },
    {
      title: 'Total Routes',
      value: totalRoutes,
      border: 'border-yellow-600',
      icon: '🛣️',
      path: '/routes',
    },
  ];

  if (isLoading && users.length === 0) {
    return (
      <div className="page-container">
        <h1 className="page-title">Home</h1>
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">Home</h1>

      <div className="summary-grid">
        {summaries.map((summary) => (
          <div
            key={summary.title}
            className={`summary-card border-l-4 ${summary.border}`}
            onClick={() => navigate(summary.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(summary.path);
            }}
          >
            <div className="summary-icon">{summary.icon}</div>
            <div className="summary-value">{summary.value}</div>
            <div className="summary-title">{summary.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
