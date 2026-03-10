import React, { useEffect, useState } from 'react';
import './ProfilePage.css';
const API = import.meta.env.VITE_API_URL || '/api/v1';

type ProfileData = {
    player: { id: string; username: string; displayName?: string; createdAt: number };
    stats: { wins: number; losses: number; draws: number; total: number };
    winRate: string;
    history: {
        id: string;
        outcome: 'win' | 'lose' | 'draw';
        playerScore?: number;
        opponentScore?: number;
        opponentNickname?: string;
        baseId?: string;
        timestamp: number;
    }[];
};

interface ProfilePageProps {
    token: string;
    username: string;
    onBack: () => void;
    onLogout: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ token, onBack, onLogout }) => {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Nickname
    const [nickname, setNickname] = useState('');
    const [nickMsg, setNickMsg] = useState('');

    // Password
    const [oldPw, setOldPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [pwMsg, setPwMsg] = useState('');

    // Delete
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteMsg, setDeleteMsg] = useState('');

    async function fetchProfile() {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API}/profile`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error);
            setProfile(data);
            setNickname(data.player.displayName || '');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchProfile(); }, []);

    async function handleNickname() {
        setNickMsg('');
        try {
            const res = await fetch(`${API}/profile/nickname`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ nickname }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error);
            setNickMsg('✅ Nickname updated!');
            fetchProfile();
        } catch (e: any) {
            setNickMsg(`❌ ${e.message}`);
        }
    }

    async function handlePassword() {
        setPwMsg('');
        try {
            const res = await fetch(`${API}/profile/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error);
            setPwMsg('✅ Password changed!');
            setOldPw('');
            setNewPw('');
        } catch (e: any) {
            setPwMsg(`❌ ${e.message}`);
        }
    }

    async function handleDelete() {
        setDeleteMsg('');
        try {
            const res = await fetch(`${API}/profile`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error);
            setDeleteMsg('Account deleted. Logging out...');
            setTimeout(() => onLogout(), 1500);
        } catch (e: any) {
            setDeleteMsg(`❌ ${e.message}`);
        }
    }

    const outcomeIcon = (o: string) => o === 'win' ? '🏆' : o === 'lose' ? '💀' : '🤝';
    const outcomeLabel = (o: string) => o === 'win' ? 'Win' : o === 'lose' ? 'Loss' : 'Draw';

    if (loading) {
        return (
            <div className="profile-page">
                <div className="profile-loading">Loading profile...</div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="profile-page">
                <div className="profile-error">
                    <p>❌ {error || 'Failed to load profile'}</p>
                    <button className="btn-primary" onClick={onBack}>Back to Lobby</button>
                </div>
            </div>
        );
    }

    const { player, stats, winRate, history } = profile;

    return (
        <div className="profile-page">
            <div className="profile-header">
                <button className="btn-back" onClick={onBack}>← Back</button>
                <h1>Player Profile</h1>
            </div>

            {/* Player Info */}
            <div className="profile-section">
                <div className="player-card">
                    <div className="player-avatar">👤</div>
                    <div className="player-details">
                        <h2>{player.displayName || player.username}</h2>
                        <span className="player-username">@{player.username}</span>
                        <span className="player-joined">
                            Joined {new Date(player.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="profile-section">
                <h3 className="section-title">📊 Statistics</h3>
                <div className="stats-grid">
                    <div className="stat-card stat-winrate">
                        <span className="stat-value">{winRate}%</span>
                        <span className="stat-label">Win Rate</span>
                    </div>
                    <div className="stat-card stat-wins">
                        <span className="stat-value">{stats.wins}</span>
                        <span className="stat-label">Wins</span>
                    </div>
                    <div className="stat-card stat-losses">
                        <span className="stat-value">{stats.losses}</span>
                        <span className="stat-label">Losses</span>
                    </div>
                    <div className="stat-card stat-total">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total</span>
                    </div>
                </div>
            </div>

            {/* Match History */}
            <div className="profile-section">
                <h3 className="section-title">🕒 Recent Matches</h3>
                {history.length === 0 ? (
                    <div className="no-matches">No matches played yet</div>
                ) : (
                    <div className="match-list">
                        {history.map((m) => (
                            <div key={m.id} className={`match-row match-${m.outcome}`}>
                                <span className="match-outcome">{outcomeIcon(m.outcome)} {outcomeLabel(m.outcome)}</span>
                                <span className="match-score">
                                    {m.playerScore ?? '?'} – {m.opponentScore ?? '?'}
                                </span>
                                <span className="match-opponent">
                                    vs {m.opponentNickname || 'Unknown'}
                                </span>
                                <span className="match-base">{m.baseId === 'doz' ? 'Doz' : 'Dec'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Settings */}
            <div className="profile-section">
                <h3 className="section-title">⚙️ Settings</h3>

                {/* Nickname */}
                <div className="setting-group">
                    <label>Nickname</label>
                    <div className="setting-row">
                        <input
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="Enter nickname"
                        />
                        <button className="btn-primary" onClick={handleNickname} disabled={!nickname.trim()}>
                            Save
                        </button>
                    </div>
                    {nickMsg && <div className="setting-msg">{nickMsg}</div>}
                </div>

                {/* Password */}
                <div className="setting-group">
                    <label>Change Password</label>
                    <div className="setting-row">
                        <input
                            type="password"
                            value={oldPw}
                            onChange={(e) => setOldPw(e.target.value)}
                            placeholder="Current password"
                        />
                        <input
                            type="password"
                            value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                            placeholder="New password"
                        />
                        <button className="btn-primary" onClick={handlePassword} disabled={!oldPw || !newPw}>
                            Change
                        </button>
                    </div>
                    {pwMsg && <div className="setting-msg">{pwMsg}</div>}
                </div>
            </div>

            {/* Danger Zone */}
            <div className="profile-section danger-zone">
                <h3 className="section-title">⚠️ Danger Zone</h3>
                {!showDeleteConfirm ? (
                    <button
                        className="btn-danger"
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        Delete Account
                    </button>
                ) : (
                    <div className="delete-confirm">
                        <p>Are you sure? This action cannot be undone.</p>
                        <div className="delete-actions">
                            <button className="btn-danger" onClick={handleDelete}>
                                Yes, delete my account
                            </button>
                            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                        </div>
                        {deleteMsg && <div className="setting-msg">{deleteMsg}</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfilePage;
