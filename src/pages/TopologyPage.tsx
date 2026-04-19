/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE = '/admin/api';

interface Node {
  id: number;
  name: string;
  ipAddresses?: string[];
  online?: boolean;
  user?: { name: string };
  forcedTags?: string[];
  validTags?: string[];
}

interface SimNode {
  id: number;
  name: string;
  ip: string;
  online: boolean;
  user: string;
  tags: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  pinned?: boolean;
}

interface Link {
  source: number;
  target: number;
  type: 'user' | 'acl' | 'tag';
}

const USER_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444',
  '#06b6d4','#84cc16','#f97316','#ec4899','#6366f1',
];

export const TopologyPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<Link[]>([]);
  const dragRef = useRef<{ node: SimNode | null; offsetX: number; offsetY: number }>({ node: null, offsetX: 0, offsetY: 0 });
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const panRef = useRef<{ active: boolean; startX: number; startY: number; tx: number; ty: number }>({ active: false, startX: 0, startY: 0, tx: 0, ty: 0 });

  const [loading, setLoading] = useState(true);
  const [nodeCount, setNodeCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [showOffline, setShowOffline] = useState(true);
  const [filterUser, setFilterUser] = useState('all');
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [, setSimTick] = useState(0);

  const userColorMap = useRef<Record<string, string>>({});

  const getUserColor = (user: string) => {
    if (!userColorMap.current[user]) {
      const idx = Object.keys(userColorMap.current).length % USER_COLORS.length;
      userColorMap.current[user] = USER_COLORS[idx];
    }
    return userColorMap.current[user];
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [nodesResp, policyResp] = await Promise.all([
        axios.get(`${API_BASE}/headscale/api/v1/node`),
        axios.get(`${API_BASE}/headscale/acl`).catch(() => ({ data: {} })),
      ]);

      const rawNodes: Node[] = nodesResp.data.nodes || [];
      const canvas = canvasRef.current;
      const W = canvas?.width || 800;
      const H = canvas?.height || 600;
      const cx = W / 2;
      const cy = H / 2;

      // Build sim nodes in a circle layout
      const users = [...new Set(rawNodes.map(n => n.user?.name || 'unowned'))];
      setAllUsers(users);

      const simNodes: SimNode[] = rawNodes.map((n, i) => {
        const angle = (i / rawNodes.length) * 2 * Math.PI;
        const r = Math.min(W, H) * 0.3;
        const tags = [...(n.forcedTags || []), ...(n.validTags || [])];
        const user = n.user?.name || 'unowned';
        return {
          id: n.id,
          name: n.name,
          ip: n.ipAddresses?.[0] || '',
          online: n.online || false,
          user,
          tags,
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
          vx: 0,
          vy: 0,
          radius: 18,
          color: getUserColor(user),
        };
      });

      // Build links — same user = linked
      const links: Link[] = [];
      const userGroups: Record<string, number[]> = {};
      simNodes.forEach(n => {
        if (!userGroups[n.user]) userGroups[n.user] = [];
        userGroups[n.user].push(n.id);
      });
      Object.values(userGroups).forEach(ids => {
        for (let i = 0; i < ids.length - 1; i++) {
          links.push({ source: ids[i], target: ids[i + 1], type: 'user' });
        }
      });

      // ACL policy links
      try {
        let policy = policyResp.data;
        if (typeof policy === 'string') policy = JSON.parse(policy);
        const acls = policy.acls || [];
        acls.forEach((rule: any) => {
          const srcList = Array.isArray(rule.src) ? rule.src : [rule.src];
          const dstList = Array.isArray(rule.dst) ? rule.dst : [rule.dst];
          srcList.forEach((src: string) => {
            dstList.forEach((dst: string) => {
              const srcNode = simNodes.find(n => src === '*' || n.ip === src || n.name === src || n.tags.includes(src));
              const dstNode = simNodes.find(n => {
                const [addr] = dst.split(':');
                return addr === '*' || n.ip === addr || n.name === addr || n.tags.includes(addr);
              });
              if (srcNode && dstNode && srcNode.id !== dstNode.id) {
                if (!links.find(l => l.source === srcNode.id && l.target === dstNode.id && l.type === 'acl')) {
                  links.push({ source: srcNode.id, target: dstNode.id, type: 'acl' });
                }
              }
            });
          });
        });
      } catch {}

      nodesRef.current = simNodes;
      linksRef.current = links;
      setNodeCount(simNodes.length);
      setOnlineCount(simNodes.filter(n => n.online).length);
      setUserCount(users.length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Force simulation
  const runSim = useCallback(() => {
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const alpha = 0.08;

    nodes.forEach(n => {
      if (n.pinned) return;
      // Repulsion between nodes
      nodes.forEach(other => {
        if (other.id === n.id) return;
        const dx = n.x - other.x;
        const dy = n.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 2200 / (dist * dist);
        n.vx += (dx / dist) * force * alpha;
        n.vy += (dy / dist) * force * alpha;
      });

      // Link attraction
      links.forEach(l => {
        const isSource = l.source === n.id;
        const isTarget = l.target === n.id;
        if (!isSource && !isTarget) return;
        const other = nodes.find(nd => nd.id === (isSource ? l.target : l.source));
        if (!other) return;
        const dx = other.x - n.x;
        const dy = other.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ideal = l.type === 'user' ? 120 : 200;
        const force = (dist - ideal) * 0.04 * alpha;
        n.vx += (dx / dist) * force * 10;
        n.vy += (dy / dist) * force * 10;
      });

      // Gravity toward center
      n.vx += (cx - n.x) * 0.01 * alpha;
      n.vy += (cy - n.y) * 0.01 * alpha;

      // Damping
      n.vx *= 0.85;
      n.vy *= 0.85;

      n.x += n.vx;
      n.y += n.vy;

      // Boundary
      n.x = Math.max(n.radius + 10, Math.min(W - n.radius - 10, n.x));
      n.y = Math.max(n.radius + 10, Math.min(H - n.radius - 10, n.y));
    });
  }, []);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x: tx, y: ty, scale } = transformRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    const nodes = nodesRef.current;
    const links = linksRef.current;

    // Draw links
    links.forEach(link => {
      const src = nodes.find(n => n.id === link.source);
      const tgt = nodes.find(n => n.id === link.target);
      if (!src || !tgt) return;
      if (!showOffline && (!src.online || !tgt.online)) return;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (link.type === 'acl') {
        ctx.strokeStyle = 'rgba(99,102,241,0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // ACL arrow
      if (link.type === 'acl') {
        const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
        const arrowX = tgt.x - Math.cos(angle) * (tgt.radius + 4);
        const arrowY = tgt.y - Math.sin(angle) * (tgt.radius + 4);
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 8 * Math.cos(angle - 0.4), arrowY - 8 * Math.sin(angle - 0.4));
        ctx.lineTo(arrowX - 8 * Math.cos(angle + 0.4), arrowY - 8 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fillStyle = 'rgba(99,102,241,0.7)';
        ctx.fill();
      }
    });

    // Draw nodes
    nodes.forEach(n => {
      const isFiltered = filterUser !== 'all' && n.user !== filterUser;
      const alpha = isFiltered ? 0.2 : 1;

      // Glow for online nodes
      if (n.online && !isFiltered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 6, 0, 2 * Math.PI);
        const grd = ctx.createRadialGradient(n.x, n.y, n.radius, n.x, n.y, n.radius + 6);
        grd.addColorStop(0, n.color + '44');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
      ctx.fillStyle = n.online
        ? n.color + (isFiltered ? '33' : 'dd')
        : '#374151' + (isFiltered ? '33' : 'cc');
      ctx.fill();
      ctx.strokeStyle = n.online ? n.color : '#6b7280';
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Status dot
      ctx.beginPath();
      ctx.arc(n.x + n.radius * 0.65, n.y - n.radius * 0.65, 5, 0, 2 * Math.PI);
      ctx.fillStyle = n.online ? '#10b981' : '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tag indicator
      if (n.tags.length > 0) {
        ctx.beginPath();
        ctx.arc(n.x - n.radius * 0.65, n.y - n.radius * 0.65, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
      }

      // Label
      if (showLabels && !isFiltered) {
        ctx.font = `bold 11px Plus Jakarta Sans, sans-serif`;
        ctx.fillStyle = '#f3f4f6';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        // Shadow
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(n.name, n.x, n.y + n.radius + 4);
        ctx.shadowBlur = 0;

        // IP
        ctx.font = '9px monospace';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(n.ip, n.x, n.y + n.radius + 17);
      }
    });

    ctx.restore();
  }, [showLabels, showOffline, filterUser]);

  // Animation loop
  useEffect(() => {
    let tick = 0;
    const loop = () => {
      runSim();
      draw();
      tick++;
      if (tick % 30 === 0) setSimTick(t => t + 1);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [runSim, draw]);

  // Load data
  useEffect(() => { fetchData(); }, []);

  // Canvas resize
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = canvas?.parentElement;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = Math.max(container.clientHeight, 500);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Mouse events
  const getCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const { x: tx, y: ty, scale } = transformRef.current;
    return {
      x: (e.clientX - rect.left - tx) / scale,
      y: (e.clientY - rect.top - ty) / scale,
    };
  };

  const findNodeAt = (x: number, y: number) => {
    return nodesRef.current.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 4;
    }) || null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const node = findNodeAt(pos.x, pos.y);
    if (node) {
      dragRef.current = { node, offsetX: pos.x - node.x, offsetY: pos.y - node.y };
      node.pinned = true;
    } else {
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    // Drag node
    if (dragRef.current.node) {
      dragRef.current.node.x = pos.x - dragRef.current.offsetX;
      dragRef.current.node.y = pos.y - dragRef.current.offsetY;
      dragRef.current.node.vx = 0;
      dragRef.current.node.vy = 0;
      return;
    }
    // Pan
    if (panRef.current.active) {
      transformRef.current.x = panRef.current.tx + (e.clientX - panRef.current.startX);
      transformRef.current.y = panRef.current.ty + (e.clientY - panRef.current.startY);
      return;
    }
    // Hover
    setHoveredNode(findNodeAt(pos.x, pos.y));
  };

  const handleMouseUp = () => {
    if (dragRef.current.node) {
      dragRef.current.node.pinned = false;
      dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
    }
    panRef.current.active = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.3, Math.min(3, transformRef.current.scale * delta));
    // Zoom toward mouse position
    transformRef.current.x = mouseX - (mouseX - transformRef.current.x) * (newScale / transformRef.current.scale);
    transformRef.current.y = mouseY - (mouseY - transformRef.current.y) * (newScale / transformRef.current.scale);
    transformRef.current.scale = newScale;
  };

  const handleReset = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
    // Reset positions
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const nodes = nodesRef.current;
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const r = Math.min(W, H) * 0.3;
      n.x = W / 2 + r * Math.cos(angle);
      n.y = H / 2 + r * Math.sin(angle);
      n.vx = 0;
      n.vy = 0;
      n.pinned = false;
    });
  };

  return (
    <div className="page-container" style={{ padding: 0, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.75rem 1rem', backgroundColor: '#111827', borderBottom: '1px solid #374151', flexShrink: 0 }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '1rem', marginRight: '0.5rem' }}>
          <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>
            <span style={{ color: '#f3f4f6', fontWeight: '700' }}>{nodeCount}</span> nodes
          </span>
          <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>
            <span style={{ color: '#10b981', fontWeight: '700' }}>{onlineCount}</span> online
          </span>
          <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>
            <span style={{ color: '#3b82f6', fontWeight: '700' }}>{userCount}</span> users
          </span>
        </div>

        <div style={{ height: '1.5rem', width: '1px', backgroundColor: '#374151' }} />

        {/* Controls */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#9ca3af', fontSize: '0.78rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} />
          Labels
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#9ca3af', fontSize: '0.78rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showOffline} onChange={e => setShowOffline(e.target.checked)} />
          Offline
        </label>

        <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
          style={{ padding: '0.3rem 0.6rem', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', color: '#f3f4f6', fontSize: '0.78rem' }}>
          <option value="all">All Users</option>
          {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <button onClick={handleReset} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>⟳ Reset</button>
        <button onClick={fetchData} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>🔄 Refresh</button>

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.72rem', color: '#6b7280' }}>
          <span><span style={{ color: '#10b981' }}>●</span> Online</span>
          <span><span style={{ color: '#ef4444' }}>●</span> Offline</span>
          <span style={{ borderBottom: '1.5px dashed rgba(99,102,241,0.7)' }}>- - -</span> ACL rule
          <span style={{ color: '#f59e0b' }}>●</span> Tagged
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#0f172a' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.875rem', zIndex: 10 }}>
            Loading topology...
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor: dragRef.current.node ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Hover tooltip */}
        {hoveredNode && (
          <div style={{
            position: 'absolute', bottom: '1rem', left: '1rem',
            backgroundColor: '#1f2937', border: '1px solid #374151',
            borderRadius: '0.5rem', padding: '0.75rem 1rem',
            fontSize: '0.8rem', color: '#d1d5db', minWidth: '180px',
            pointerEvents: 'none',
          }}>
            <div style={{ color: '#f3f4f6', fontWeight: '700', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
              <span style={{ marginRight: '0.4rem' }}>{hoveredNode.online ? '🟢' : '🔴'}</span>
              {hoveredNode.name}
            </div>
            <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>IP: <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{hoveredNode.ip}</span></div>
            <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.2rem' }}>
              Owner: <span style={{ color: hoveredNode.color, fontWeight: '600' }}>{hoveredNode.user}</span>
            </div>
            {hoveredNode.tags.length > 0 && (
              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {hoveredNode.tags.map(t => (
                  <span key={t} style={{ backgroundColor: '#1e3a5f', color: '#60a5fa', padding: '0.1rem 0.35rem', borderRadius: '0.2rem', fontSize: '0.68rem' }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Help hint */}
        <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', color: '#374151', fontSize: '0.7rem', textAlign: 'right', pointerEvents: 'none' }}>
          Drag nodes • Scroll to zoom • Drag background to pan
        </div>
      </div>
    </div>
  );
};
