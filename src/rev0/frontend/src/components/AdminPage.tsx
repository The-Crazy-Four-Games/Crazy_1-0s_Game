import React, { useState, useEffect } from 'react';
import './AdminPage.css';

const API = 'http://localhost:3001/api/v1';

interface PlayerResult {
    id: string;
    username: string;
    displayName?: string;
    createdAt: number;
    stats: { wins: number; losses: number; draws: number; total: number };
}

interface RoomResult {
    lobbyId: string;
    hostId: string;
    hostUsername: string;
    guestId?: string;
    baseId: string;
    status: string;
}

interface AdminPageProps {
    token: string;
    onLogout: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ token, onLogout }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<PlayerResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState('');
    const [rooms, setRooms] = useState<RoomResult[]>([]);

    async function fetchRooms() {
        try {
            const res = await fetch(`${API}/admin/rooms`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) setRooms(data.rooms);
        } catch { /* ignore */ }
    }

    useEffect(() => { fetchRooms(); }, []);

    async function doSearch() {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setActionMsg('');
        try {
            const res = await fetch(`${API}/admin/players?q=${encodeURIComponent(searchQuery)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error);
            setResults(data.players);
        } catch (e: any) {
            setActionMsg(`❌ ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function resetPassword(playerId: string, username: string) {
        const newPw = prompt(`Enter new password for ${username}:`);
        if (!newPw) return;
        try {
            const res = await fetch(`${API}/admin/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ playerId, newPassword: newPw }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error);
            setActionMsg(`✅ Password reset for ${username}`);
        } catch (e: any) {
            setActionMsg(`❌ ${e.message}`);
        }
    }

    async function clearHistory(playerId: string, username: string) {
        if (!confirm(`Clear all match history for ${username}?`)) return;
        try {
            const res = await fetch(`${API}/admin/clear-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ playerId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error);
            setActionMsg(`✅ History cleared for ${username}`);
            doSearch();
        } catch (e: any) {
            setActionMsg(`❌ ${e.message}`);
        }
    }

    async function forceLogout(playerId: string, username: string) {
        if (!confirm(`Force logout ${username}? They will be kicked immediately.`)) return;
        try {
            const res = await fetch(`${API}/admin/force-logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ playerId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error);
            setActionMsg(`✅ ${username} has been force-logged out`);
        } catch (e: any) {
            setActionMsg(`❌ ${e.message}`);
        }
    }

    async function deleteRoom(lobbyId: string) {
        if (!confirm(`Delete room ${lobbyId}? Players will be kicked.`)) return;
        try {
            const res = await fetch(`${API}/admin/delete-room`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ lobbyId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error);
            setActionMsg(`✅ Room ${lobbyId} deleted`);
            fetchRooms();
        } catch (e: any) {
            setActionMsg(`❌ ${e.message}`);
        }
    }

    return (
        <div className="admin-page">
            <div className="admin-header">
                <h1>🛡️ Admin Panel</h1>
                <button className="btn-outline" onClick={onLogout}>Logout</button>
            </div>

            {/* Search */}
            <div className="admin-section">
                <h3>Search Players</h3>
                <div className="search-bar">
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by username or nickname..."
                        onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                    />
                    <button className="btn-primary" onClick={doSearch} disabled={loading}>
                        {loading ? '...' : '🔍 Search'}
                    </button>
                </div>
            </div>

            {actionMsg && <div className="action-msg">{actionMsg}</div>}

            {/* Results */}
            {results.length > 0 && (
                <div className="admin-section">
                    <h3>Results ({results.length})</h3>
                    <div className="player-list">
                        {results.map((p) => (
                            <div key={p.id} className="player-row">
                                <div className="player-info">
                                    <span className="player-name">
                                        {p.displayName || p.username}
                                        <span className="player-username-sub">@{p.username}</span>
                                    </span>
                                    <span className="player-stats-mini">
                                        W{p.stats.wins} / L{p.stats.losses} / D{p.stats.draws} ({p.stats.total} games)
                                    </span>
                                </div>
                                <div className="player-actions">
                                    <button className="btn-sm btn-warn" onClick={() => resetPassword(p.id, p.username)}>
                                        🔑 Reset PW
                                    </button>
                                    <button className="btn-sm btn-warn" onClick={() => clearHistory(p.id, p.username)}>
                                        🗑️ Clear History
                                    </button>
                                    <button className="btn-sm btn-danger" onClick={() => forceLogout(p.id, p.username)}>
                                        ⚡ Force Logout
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {results.length === 0 && searchQuery && !loading && (
                <div className="no-results">No players found</div>
            )}

            {/* Game Rooms */}
            <div className="admin-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Game Rooms ({rooms.length})</h3>
                    <button className="btn-sm btn-warn" onClick={fetchRooms}>🔄 Refresh</button>
                </div>
                {rooms.length === 0 ? (
                    <div className="no-results" style={{ padding: '12px' }}>No open rooms</div>
                ) : (
                    <div className="player-list">
                        {rooms.map((rm) => (
                            <div key={rm.lobbyId} className="player-row">
                                <div className="player-info">
                                    <span className="player-name">
                                        🏠 {rm.hostUsername}'s Room
                                        <span className="player-username-sub">{rm.lobbyId}</span>
                                    </span>
                                    <span className="player-stats-mini">
                                        {rm.guestId ? '👥 2/2 players' : '👤 1/2 players'} · {rm.baseId}
                                    </span>
                                </div>
                                <div className="player-actions">
                                    <button className="btn-sm btn-danger" onClick={() => deleteRoom(rm.lobbyId)}>
                                        🗑️ Delete Room
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
