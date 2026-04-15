/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

interface Props {
  onClose: () => void;
  visibleUsers: { id: string; name: string }[];
}

// const API = '/admin/api/headscale'; // unused
const SERVER = window.location.origin;

const InfoTip: React.FC<{ text: string }> = ({ text }) => (
  <span title={text} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#3b82f6', color: 'white', fontSize: '10px', fontWeight: 'bold', cursor: 'help', flexShrink: 0 }}>i</span>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <div onClick={() => onChange(!checked)} style={{ width: '22px', height: '22px', border: `2px solid ${checked ? '#6366f1' : '#374151'}`, borderRadius: '4px', backgroundColor: checked ? '#6366f1' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {checked && <span style={{ color: 'white', fontSize: '14px', lineHeight: 1 }}>✓</span>}
  </div>
);

const TagInput: React.FC<{ tags: string[]; onChange: (tags: string[]) => void; placeholder: string }> = ({ tags, onChange, placeholder }) => {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); setInput(''); }
  };
  return (
    <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', padding: '0.5rem', minHeight: '60px' }}>
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        placeholder={placeholder} style={{ background: 'none', border: 'none', outline: 'none', color: '#f3f4f6', width: '100%', fontSize: '0.875rem', marginBottom: '0.5rem' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {tags.map(t => (
          <span key={t} style={{ backgroundColor: '#374151', color: '#d1d5db', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {t} <span onClick={() => onChange(tags.filter(x => x !== t))} style={{ cursor: 'pointer', color: '#9ca3af' }}>×</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export const DeployModal: React.FC<Props> = ({ onClose, visibleUsers }) => {
  // const { user: authUser } = useAuthStore(); // unused

  // General
  const [shieldsUp, setShieldsUp] = useState(false);
  const [generateQR, setGenerateQR] = useState(false);
  const [reset, setReset] = useState(true);
  const [operator, setOperator] = useState(false);
  const [forceReauth, setForceReauth] = useState(true);
  const [sshServer, setSshServer] = useState(true);
  const [usePreAuthKey, setUsePreAuthKey] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [preAuthKeyExpiry, setPreAuthKeyExpiry] = useState(90);
  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);

  // Advertise
  const [advertiseExitNode, setAdvertiseExitNode] = useState(false);
  const [advertiseTags, setAdvertiseTags] = useState(true);
  const [advertiseTagsList, setAdvertiseTagsList] = useState<string[]>(['tag:server']);
  const [advertiseRoutes, setAdvertiseRoutes] = useState(true);
  const [advertiseRoutesList, setAdvertiseRoutesList] = useState<string[]>(['10.1.1.0/24']);

  // Accept
  const [acceptDNS, setAcceptDNS] = useState(false);
  const [acceptRoutes, setAcceptRoutes] = useState(true);
  const [exitNode, setExitNode] = useState(false);

  const [command, setCommand] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    buildCommand();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shieldsUp, generateQR, reset, operator, forceReauth, sshServer, usePreAuthKey,
      generatedKey, advertiseExitNode, advertiseTags, advertiseTagsList,
      advertiseRoutes, advertiseRoutesList, acceptDNS, acceptRoutes, exitNode]);

  const buildCommand = () => {
    let parts = [`tailscale up --login-server=${SERVER}`];
    if (reset) parts.push('--reset');
    if (forceReauth) parts.push('--force-reauth');
    if (sshServer) parts.push('--ssh');
    if (shieldsUp) parts.push('--shields-up');
    if (operator) parts.push('--operator=$USER');
    if (advertiseExitNode) parts.push('--advertise-exit-node');
    if (advertiseTags && advertiseTagsList.length > 0) parts.push(`--advertise-tags=${advertiseTagsList.join(',')}`);
    if (advertiseRoutes && advertiseRoutesList.length > 0) parts.push(`--advertise-routes=${advertiseRoutesList.join(',')}`);
    if (acceptDNS) parts.push('--accept-dns');
    if (acceptRoutes) parts.push('--accept-routes');
    if (exitNode) parts.push('--exit-node-allow-lan-access');
    if (usePreAuthKey && generatedKey) parts.push(`--auth-key=${generatedKey}`);
    setCommand(parts.join(' '));
  };

  const handleGeneratePreAuthKey = async () => {
    if (!selectedUser) return alert('Select a user first');
    setGeneratingKey(true);
    try {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + preAuthKeyExpiry);
      // Use the server endpoint which handles auth correctly
      const resp = await axios.post('/admin/api/headscale/preauthkey/create', {
        userId: selectedUser,
        reusable,
        ephemeral,
        expiration: expDate.toISOString(),
        tags: advertiseTags ? advertiseTagsList : []
      });
      setGeneratedKey(resp.data.key || '');
    } catch (e: any) {
      alert('Failed to generate key: ' + (e.response?.data?.message || e.message));
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {children}
      </div>
    </div>
  );

  const CheckRow: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; tip: string }> = ({ label, checked, onChange, tip }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <InfoTip text={tip} />
      <Toggle checked={checked} onChange={onChange} />
      <span style={{ color: '#d1d5db', fontSize: '0.875rem' }}>{label}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.75rem', width: '95%', maxWidth: '1100px', maxHeight: '90vh', overflowY: 'auto', color: '#d1d5db' }}>

        {/* Header + command - sticky */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #374151', position: 'sticky', top: 0, backgroundColor: '#111827', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, color: '#f3f4f6', fontSize: '1.25rem' }}>🚀 Deploy New Node</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={handleCopy} style={{ padding: '0.4rem 1rem', backgroundColor: copied ? '#10b981' : '#6366f1', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}>
                {copied ? '✓ Copied!' : '📋 Copy Command'}
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px dashed #374151', borderRadius: '0.375rem', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#86efac', wordBreak: 'break-all', lineHeight: 1.6 }}>
            {command || 'Configure options below...'}
          </div>
        </div>

        {/* Options */}
        <div style={{ padding: '1.5rem' }}>

          {/* General */}
          <Section title="General">
            <CheckRow label="Shields Up" checked={shieldsUp} onChange={setShieldsUp} tip="Block all incoming connections" />
            <CheckRow label="Generate QR Code" checked={generateQR} onChange={setGenerateQR} tip="Generate a QR code for easy auth" />
            <CheckRow label="Reset" checked={reset} onChange={setReset} tip="Reset settings before applying new ones" />
            <CheckRow label="Operator" checked={operator} onChange={setOperator} tip="Run as the current OS user" />
            <CheckRow label="Force Reauthentication" checked={forceReauth} onChange={setForceReauth} tip="Force device to re-authenticate" />
            <CheckRow label="SSH Server" checked={sshServer} onChange={setSshServer} tip="Enable Tailscale SSH server on this node" />
          </Section>

          {/* Pre-Auth Key */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Pre-Auth Key</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <InfoTip text="Use a pre-auth key to register the node without manual login" />
              <Toggle checked={usePreAuthKey} onChange={setUsePreAuthKey} />
              <span style={{ color: '#d1d5db', fontSize: '0.875rem' }}>Use Pre-Auth Key</span>
            </div>

            {usePreAuthKey && (
              <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {!generatedKey ? (
                  <>
                    {/* Single row: User + Expiry + Reusable + Ephemeral + Generate */}
                    {/* Two-row layout: user+expiry left, reusable+ephemeral+generate right */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                      {/* Left: User + Expiry */}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                        <div style={{ width: '180px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>User:</label>
                          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#f3f4f6', fontSize: '0.875rem' }}>
                            <option value="">Select user...</option>
                            {visibleUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                        <div style={{ width: '90px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Expires (days):</label>
                          <input type="number" value={preAuthKeyExpiry} onChange={e => setPreAuthKeyExpiry(Number(e.target.value))} min={1} max={90}
                            style={{ width: '100%', padding: '0.5rem', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#f3f4f6', fontSize: '0.875rem' }} />
                        </div>
                      </div>
                      {/* Right: Reusable + Ephemeral + Generate */}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#d1d5db', fontSize: '0.875rem', cursor: 'pointer' }}>
                          <Toggle checked={reusable} onChange={setReusable} /> Reusable
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#d1d5db', fontSize: '0.875rem', cursor: 'pointer' }}>
                          <Toggle checked={ephemeral} onChange={setEphemeral} /> Ephemeral
                        </label>
                        <button onClick={handleGeneratePreAuthKey} disabled={!selectedUser || generatingKey}
                          style={{ padding: '0.5rem 1.25rem', backgroundColor: selectedUser ? '#6366f1' : '#4b5563', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: selectedUser ? 'pointer' : 'not-allowed', fontWeight: '600', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                          {generatingKey ? 'Generating...' : '🔑 Generate'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Key generated — show key box + Copy/Clear left-aligned under user field */
                  <div>
                    <div style={{ width: '180px', marginBottom: '0.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Pre-Auth Key:</label>
                    </div>
                    <div style={{ backgroundColor: '#0f172a', border: '1px solid #10b981', borderRadius: '0.25rem', padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#10b981', wordBreak: 'break-all', marginBottom: '0.5rem' }}>
                      {generatedKey}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => { navigator.clipboard.writeText(generatedKey); alert('Key copied!'); }}
                        style={{ padding: '0.4rem 0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                        📋 Copy Key
                      </button>
                      <button onClick={() => setGeneratedKey('')}
                        style={{ padding: '0.4rem 0.75rem', backgroundColor: '#374151', color: '#d1d5db', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                        ✕ Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advertise */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Advertise</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <CheckRow label="Advertise Exit Node" checked={advertiseExitNode} onChange={setAdvertiseExitNode} tip="Make this node available as an exit node for the network" />
              <CheckRow label="Advertise Tags" checked={advertiseTags} onChange={setAdvertiseTags} tip="Apply ACL tags to this node" />
              <CheckRow label="Advertise Routes" checked={advertiseRoutes} onChange={setAdvertiseRoutes} tip="Share subnet routes with the network" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {advertiseTags && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Tags (press Enter to add):</label>
                  <TagInput tags={advertiseTagsList} onChange={setAdvertiseTagsList} placeholder="e.g. tag:server" />
                </div>
              )}
              {advertiseRoutes && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Routes (press Enter to add):</label>
                  <TagInput tags={advertiseRoutesList} onChange={setAdvertiseRoutesList} placeholder="e.g. 10.1.1.0/24" />
                </div>
              )}
            </div>
          </div>

          {/* Accept */}
          <Section title="Accept">
            <CheckRow label="Accept DNS" checked={acceptDNS} onChange={setAcceptDNS} tip="Use Tailscale DNS resolver" />
            <CheckRow label="Accept Routes" checked={acceptRoutes} onChange={setAcceptRoutes} tip="Accept subnet routes from other nodes" />
            <CheckRow label="Exit Node LAN" checked={exitNode} onChange={setExitNode} tip="Allow LAN access when using an exit node" />
          </Section>

        </div>
      </div>
    </div>
  );
};
