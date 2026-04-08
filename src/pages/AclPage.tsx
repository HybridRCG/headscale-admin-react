import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import '../styles/Pages.css';

export const AclPage: React.FC = () => {
  const [aclContent, setAclContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchACL();
  }, []);

  const fetchACL = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/admin/api/headscale/api/v1/policy');
      
      let policyData = response.data;
      if (typeof policyData.policy === 'string') {
        policyData = JSON.parse(policyData.policy);
      }
      
      setAclContent(JSON.stringify(policyData, null, 2));
    } catch (err) {
      setError('Failed to load ACL policy');
      console.error('ACL fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const policyObj = JSON.parse(aclContent);
      
      await axios.post('/admin/api/headscale/api/v1/policy', { policy: policyObj });
      alert('ACL policy saved successfully!');
      setEditing(false);
    } catch (err) {
      setError('Failed to save ACL policy. Invalid JSON or API error.');
      console.error('Save error:', err);
    }
  };

  const handleCancel = () => {
    fetchACL();
    setEditing(false);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">ACL Editor</h1>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary" onClick={fetchACL} disabled={loading || editing}>
          🔄 Refresh
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (editing) {
              handleSave();
            } else {
              setEditing(true);
            }
          }}
          disabled={loading}
        >
          {editing ? '💾 Save' : '✏️ Edit'}
        </button>
        {editing && (
          <button className="btn btn-primary" onClick={handleCancel} style={{ backgroundColor: '#ef4444' }}>
            ❌ Cancel
          </button>
        )}
      </div>

      {error && (
        <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '1rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading ACL policy...</div>
      ) : (
        <div style={{ height: '600px', border: '1px solid #374151', borderRadius: '0.375rem', overflow: 'hidden' }}>
          <Editor
            height="100%"
            language="json"
            value={aclContent}
            onChange={(value) => setAclContent(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              readOnly: !editing,
              wordWrap: 'on',
              formatOnPaste: true,
              formatOnType: true,
            }}
          />
        </div>
      )}
    </div>
  );
};
