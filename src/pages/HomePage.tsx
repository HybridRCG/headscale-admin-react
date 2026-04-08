import React, { useEffect } from 'react';
import { useHeadscaleStore } from '../store/headscaleStore';
import { useNavigate } from 'react-router-dom';
import '../styles/Pages.css';

interface SummaryCard {
  title: string;
  border: string;
  icon: string;
  path?: string;
  isNav?: boolean;
}

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { users, nodes, fetchUsers, fetchNodes } = useHeadscaleStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([fetchUsers(), fetchNodes()]);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };

    fetchData();
  }, []);

  const summaries: SummaryCard[] = [
    {
      title: 'Users',
      border: 'border-blue-700',
      icon: '👤',
      path: '/users',
    },
    {
      title: 'Nodes',
      border: 'border-purple-700',
      icon: '🖥️',
      path: '/nodes',
    },
    {
      title: 'ACL Editor',
      border: 'border-green-700',
      icon: '📋',
      path: '/acl',
      isNav: true,
    },
    {
      title: 'DNS',
      border: 'border-orange-700',
      icon: '🌐',
      path: '/dns',
      isNav: true,
    },
    {
      title: 'Settings',
      border: 'border-gray-700',
      icon: '⚙️',
      path: '/settings',
      isNav: true,
    },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">Home</h1>

      <div className="summary-grid">
        {summaries.map((summary) => (
          <div
            key={summary.title}
            className={`summary-card border-l-4 ${summary.border}`}
            onClick={() => summary.path && navigate(summary.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && summary.path) navigate(summary.path);
            }}
            style={{ cursor: summary.path ? 'pointer' : 'default' }}
          >
            <div className="summary-icon-large">{summary.icon}</div>
            <div className="summary-title-bold">{summary.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
