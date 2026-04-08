import React, { useEffect, useState, useMemo } from 'react';
import { useHeadscaleStore, Direction, OnlineStatus, User } from '../store/headscaleStore';
import '../styles/Pages.css';

interface UserCardProps {
  user: User;
  isOnline: boolean;
  preAuthKeyCount: number;
  nodeCount: number;
  onRename: (userId: string, newName: string) => void;
  onDelete: (userId: string) => void;
  onCreatePreAuthKey: (userId: string) => void;
  onExpirePreAuthKey: (keyId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  isOnline,
  preAuthKeyCount,
  nodeCount,
  onRename,
  onDelete,
  onCreatePreAuthKey,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(user.name);

  const handleRename = async () => {
    if (newName && newName !== user.name) {
      await onRename(user.id, newName);
    }
    setIsRenaming(false);
  };

  return (
    <div className="user-card">
      <div className="user-header">
        <div className="user-status">
          <span className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? '🟢' : '🔴'}
          </span>
        </div>

        {isRenaming ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            autoFocus
            className="user-name-input"
          />
        ) : (
          <h3
            className="user-name"
            onClick={() => setIsRenaming(true)}
            title="Click to rename"
          >
            {user.name}
          </h3>
        )}

        <button
          className="btn btn-delete"
          onClick={() => onDelete(user.id)}
          title="Delete user"
        >
          ✕
        </button>
      </div>

      <div className="user-info">
        <div className="info-row">
          <span className="info-label">ID:</span>
          <span className="info-value">{user.id}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Nodes:</span>
          <span className="info-value">{nodeCount}</span>
        </div>
        <div className="info-row">
          <span className="info-label">PreAuth Keys:</span>
          <span className="info-value">{preAuthKeyCount}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Created:</span>
          <span className="info-value">{new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="user-actions">
        <button className="btn btn-primary" onClick={() => onCreatePreAuthKey(user.id)}>
          Create PreAuth Key
        </button>
      </div>
    </div>
  );
};

export const UsersPage: React.FC = () => {
  const {
    users,
    nodes,
    preAuthKeys,
    fetchUsers,
    fetchNodes,
    fetchPreAuthKeys,
    createUser,
    renameUser,
    deleteUser,
    createPreAuthKey,
    isLoading,
    error,
  } = useHeadscaleStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [sortBy, setSortBy] = useState<'id' | 'name'>('name');
  const [sortDir, setSortDir] = useState<Direction>('up');
  const [filterOnline, setFilterOnline] = useState<OnlineStatus>('all');
  const [filterString, setFilterString] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([fetchUsers(), fetchNodes(), fetchPreAuthKeys()]);
      } catch (error) {
        console.error('Failed to fetch users data:', error);
      }
    };

    fetchData();
  }, []);

  const filteredUsers = useMemo(() => {
    let filtered = users;

    if (filterString) {
      filtered = filtered.filter((u) =>
        u.name.toLowerCase().includes(filterString.toLowerCase()) ||
        u.id.toLowerCase().includes(filterString.toLowerCase())
      );
    }

    if (filterOnline !== 'all') {
      const onlineUserIds = nodes
        .filter((n) => (filterOnline === 'online' ? n.online : !n.online))
        .map((n) => n.user.id);
      filtered = filtered.filter((u) => onlineUserIds.includes(u.id));
    }

    filtered = [...filtered].sort((a, b) => {
      const aVal = sortBy === 'id' ? a.id : a.name;
      const bVal = sortBy === 'id' ? b.id : b.name;
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'up' ? cmp : -cmp;
    });

    return filtered;
  }, [users, nodes, filterString, filterOnline, sortBy, sortDir]);

  const handleCreateUser = async () => {
    if (newUserName.trim()) {
      try {
        await createUser(newUserName);
        setNewUserName('');
        setShowCreate(false);
      } catch (error) {
        console.error('Failed to create user:', error);
      }
    }
  };

  const handleCreatePreAuthKey = async (userId: string) => {
    try {
      await createPreAuthKey(userId, true, false);
    } catch (error) {
      console.error('Failed to create preauth key:', error);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Users</h1>

        <input
          type="text"
          placeholder="Filter users..."
          value={filterString}
          onChange={(e) => setFilterString(e.target.value)}
          className="search-input"
        />

        <button
          className="btn btn-primary"
          onClick={() => setShowCreate(!showCreate)}
          disabled={isLoading}
        >
          {showCreate ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showCreate && (
        <div className="create-user-form">
          <input
            type="text"
            placeholder="New user name"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateUser();
              if (e.key === 'Escape') setShowCreate(false);
            }}
            autoFocus
            className="create-input"
          />
          <button className="btn btn-success" onClick={handleCreateUser}>
            Create
          </button>
        </div>
      )}

      <div className="controls">
        <div className="sort-controls">
          <button
            className={`sort-btn ${sortBy === 'id' ? 'active' : ''}`}
            onClick={() => {
              if (sortBy === 'id') setSortDir(sortDir === 'up' ? 'down' : 'up');
              else setSortBy('id');
            }}
          >
            ID {sortBy === 'id' && (sortDir === 'up' ? '↑' : '↓')}
          </button>
          <button
            className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
            onClick={() => {
              if (sortBy === 'name') setSortDir(sortDir === 'up' ? 'down' : 'up');
              else setSortBy('name');
            }}
          >
            Name {sortBy === 'name' && (sortDir === 'up' ? '↑' : '↓')}
          </button>
        </div>

        <div className="filter-controls">
          <button
            className={`filter-btn ${filterOnline === 'all' ? 'active' : ''}`}
            onClick={() => setFilterOnline('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filterOnline === 'online' ? 'active' : ''}`}
            onClick={() => setFilterOnline('online')}
          >
            Online
          </button>
          <button
            className={`filter-btn ${filterOnline === 'offline' ? 'active' : ''}`}
            onClick={() => setFilterOnline('offline')}
          >
            Offline
          </button>
        </div>
      </div>

      {isLoading && filteredUsers.length === 0 ? (
        <div className="loading">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="no-results">No users found</div>
      ) : (
        <div className="users-grid">
          {filteredUsers.map((user) => {
            const isOnline = nodes.some((n) => n.user.id === user.id && n.online);
            const userNodeCount = nodes.filter((n) => n.user.id === user.id).length;
            const userKeyCount = preAuthKeys.filter((k) => k.user.id === user.id).length;

            return (
              <UserCard
                key={user.id}
                user={user}
                isOnline={isOnline}
                nodeCount={userNodeCount}
                preAuthKeyCount={userKeyCount}
                onRename={renameUser}
                onDelete={deleteUser}
                onCreatePreAuthKey={handleCreatePreAuthKey}
                onExpirePreAuthKey={() => {}}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
