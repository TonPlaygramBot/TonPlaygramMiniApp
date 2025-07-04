import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { getTelegramId, getTelegramPhotoUrl, getPlayerId } from '../utils/telegram.js';
import { FaCircle } from 'react-icons/fa';
import {
  getLeaderboard,
  getReferralInfo,
  fetchTelegramInfo,
  getProfile,
  listFriendRequests,
  acceptFriendRequest,
  getOnlineCount,
  getOnlineUsers
} from '../utils/api.js';
import UserSearchBar from '../components/UserSearchBar.jsx';
import { BOT_USERNAME } from '../utils/constants.js';
import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';
import { socket } from '../utils/socket.js';
import InvitePopup from '../components/InvitePopup.jsx';

export default function Friends() {
  useTelegramBackButton();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }
  const accountId = getPlayerId();

  const [referral, setReferral] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [rank, setRank] = useState(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState(
    loadAvatar() || getTelegramPhotoUrl()
  );
  const [friendRequests, setFriendRequests] = useState([]);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [myName, setMyName] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [mode, setMode] = useState('1v1');
  const [selected, setSelected] = useState([]);
  const [groupPopup, setGroupPopup] = useState(false);

  useEffect(() => {
    getReferralInfo(telegramId).then(setReferral);
    getLeaderboard(telegramId).then((data) => {
      setLeaderboard(data.users);
      setRank(data.rank);
    });
    listFriendRequests(telegramId).then(setFriendRequests);

    const saved = loadAvatar();
    if (saved) {
      setMyPhotoUrl(saved);
      getProfile(telegramId)
        .then((p) =>
          setMyName(
            p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim(),
          ),
        )
        .catch(() => {});
    } else {
      getProfile(telegramId)
        .then((p) => {
          if (p?.photo) {
            setMyPhotoUrl(p.photo);
            saveAvatar(p.photo);
          } else {
            fetchTelegramInfo(telegramId).then((info) => {
              if (info?.photoUrl) setMyPhotoUrl(info.photoUrl);
            });
          }
          setMyName(p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim());
        })
        .catch(() => {
          fetchTelegramInfo(telegramId).then((info) => {
            if (info?.photoUrl) setMyPhotoUrl(info.photoUrl);
            setMyName(`${info?.firstName || ''} ${info?.lastName || ''}`.trim());
          });
        });
    }
  }, [telegramId]);

  useEffect(() => {
    const updatePhoto = () => {
      const saved = loadAvatar();
      if (saved) {
        setMyPhotoUrl(saved);
      } else {
        getProfile(telegramId)
          .then((p) => {
            setMyPhotoUrl(p?.photo || getTelegramPhotoUrl());
            if (p?.photo) saveAvatar(p.photo);
            setMyName(p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim());
          })
          .catch(() => setMyPhotoUrl(getTelegramPhotoUrl()));
      }
    };
    window.addEventListener('profilePhotoUpdated', updatePhoto);
    return () => window.removeEventListener('profilePhotoUpdated', updatePhoto);
  }, [telegramId]);

  useEffect(() => {
    function loadOnline() {
      getOnlineUsers().then((d) => setOnlineUsers(d.users || []));
      getOnlineCount().then((d) => setOnlineCount(d.count || 0));
    }
    loadOnline();
    const id = setInterval(loadOnline, 30000);
    return () => clearInterval(id);
  }, []);

  if (!referral) return <div className="p-4">Loading...</div>;

  const link = `https://t.me/${BOT_USERNAME}?start=${referral.referralCode}`;

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-4 text-text overflow-hidden">
      <img
        loading="lazy"
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h2 className="text-xl font-bold">Friends</h2>

      {friendRequests.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-lg font-semibold">Friend Requests</h3>
          {friendRequests.map((fr) => (
            <div key={fr._id} className="lobby-tile flex items-center justify-between">
              <span>{fr.from}</span>
              <button
                onClick={async () => {
                  await acceptFriendRequest(fr._id);
                  listFriendRequests(telegramId).then(setFriendRequests);
                }}
                className="px-2 py-1 text-sm bg-primary hover:bg-primary-hover rounded"
              >
                Accept
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-1">
        <h3 className="text-lg font-semibold">Friends</h3>
        <p>Invited friends: {referral.referralCount}</p>
        <p>Mining boost: +{referral.bonusMiningRate * 100}%</p>
        {referral.storeMiningRate && referral.storeMiningExpiresAt && (
          <p className="text-sm text-subtext">
            Boost ends in {Math.max(0, Math.floor((new Date(referral.storeMiningExpiresAt).getTime() - Date.now()) / 86400000))}d
          </p>
        )}
      </section>

      <section className="space-y-1">
        <h3 className="text-lg font-semibold">Referral</h3>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={link}
            onClick={(e) => e.target.select()}
            className="flex-1 bg-surface border border-border rounded px-2 py-1 text-sm"
          />
          <button
            onClick={() => navigator.clipboard.writeText(link)}
            className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-sm text-white-shadow"
          >
            Copy
          </button>
        </div>
      </section>

      <section id="leaderboard" className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden">
        <img
          loading="lazy"
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board object-cover"
          alt=""
        />
        <h3 className="text-lg font-semibold flex items-center justify-between">
          <span>Leaderboard</span>
          <span className="flex items-center space-x-2">
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setSelected([]);
              }}
              className="bg-surface border border-border rounded text-sm"
            >
              <option value="1v1">1v1</option>
              <option value="group">Group</option>
            </select>
            <FaCircle className={onlineCount > 0 ? 'text-green-500' : 'text-red-500'} size={10} />
            <span className="ml-1">{onlineCount}</span>
          </span>
        </h3>
        <div className="max-h-[80rem] overflow-y-auto border border-border rounded">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left">
                <th className="p-2">#</th>
                <th className="p-2 w-16"></th>
                <th className="p-2">User</th>
                <th className="p-2 text-right">TPC</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((u, idx) => (
                <tr
                  key={u.accountId || u.telegramId}
                  className={`border-b border-border h-16 ${u.accountId === accountId ? 'bg-accent text-black' : 'cursor-pointer'}`}
                  onClick={() => {
                    if (u.accountId === accountId || u.currentTableId) return;
                    if (mode === 'group') {
                      setSelected((prev) => {
                        const exists = prev.find((p) => p.accountId === u.accountId);
                        if (exists) return prev.filter((p) => p.accountId !== u.accountId);
                        if (prev.length >= 3) return prev;
                        return [...prev, u];
                      });
                    } else {
                      setInviteTarget(u);
                    }
                  }}
                >
                  <td className="p-2">{idx + 1}</td>
                  <td className="p-2 w-16">
                    <img
                      src={getAvatarUrl(
                        u.accountId === accountId
                          ? myPhotoUrl || '/assets/icons/profile.svg'
                          : u.photo || u.photoUrl || '/assets/icons/profile.svg'
                      )}
                      alt="avatar"
                      className="w-16 h-16 hexagon border-2 border-brand-gold object-cover shadow-[0_0_12px_rgba(241,196,15,0.8)]"
                    />
                  </td>
                  <td className="p-2 flex items-center">
                    {mode === 'group' && u.accountId !== accountId && (
                      <input
                        type="checkbox"
                        disabled={!!u.currentTableId}
                        checked={selected.some((p) => p.accountId === u.accountId)}
                        onChange={() => {}}
                        className="mr-1"
                      />
                    )}
                    {u.nickname || `${u.firstName} ${u.lastName}`.trim() || 'User'}
                    {u.currentTableId && (
                      <span className="ml-1 text-xs text-red-500">playing not available</span>
                    )}
                    {onlineUsers.includes(String(u.accountId)) && (
                      <FaCircle className="ml-1 text-green-500" size={8} />
                    )}
                  </td>
                  <td className="p-2 text-right">{u.balance}</td>
                </tr>
              ))}
              {rank && rank > 100 && (
                <tr className="bg-accent text-black h-16">
                  <td className="p-2">{rank}</td>
                  <td className="p-2 w-16">
                    <img
                      src={getAvatarUrl(myPhotoUrl || '/assets/icons/profile.svg')}
                      alt="avatar"
                      className="w-16 h-16 hexagon border-2 border-brand-gold object-cover shadow-[0_0_12px_rgba(241,196,15,0.8)]"
                    />
                  </td>
                  <td className="p-2 flex items-center">
                    You
                    {onlineUsers.includes(String(accountId)) && (
                      <FaCircle className="ml-1 text-green-500" size={8} />
                    )}
                  </td>
                  <td className="p-2 text-right">{leaderboard.find((u) => u.accountId === accountId)?.balance ?? '...'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-1">
        <h3 className="text-lg font-semibold">Add Friends</h3>
        <UserSearchBar />
      </section>
      {mode === 'group' && (
        <div className="space-y-2">
          <p className="text-sm">Selected {selected.length}/3</p>
          <button
            onClick={() => setGroupPopup(true)}
            disabled={selected.length === 0}
            className="px-2 py-1 bg-primary hover:bg-primary-hover rounded disabled:opacity-50"
          >
            Invite Group
          </button>
        </div>
      )}
      <InvitePopup
        open={!!inviteTarget}
        name={inviteTarget?.nickname || `${inviteTarget?.firstName || ''} ${inviteTarget?.lastName || ''}`.trim()}
        stake={stake}
        onStakeChange={setStake}
        onAccept={() => {
          if (inviteTarget) {
            const roomId = `invite-${accountId}-${inviteTarget.accountId}-${Date.now()}-2`;
            socket.emit(
              'invite1v1',
              {
                fromId: accountId,
                fromTelegramId: telegramId,
                fromName: myName,
                toId: inviteTarget.accountId,
                toTelegramId: inviteTarget.telegramId,
                roomId,
                token: stake.token,
                amount: stake.amount,
              },
              (res) => {
                if (res && res.success) {
                  window.location.href = `/games/snake?table=${roomId}&token=${stake.token}&amount=${stake.amount}`;
                } else {
                  alert(res?.error || 'Failed to send invite');
                }
              },
            );
          }
          setInviteTarget(null);
        }}
        onReject={() => setInviteTarget(null)}
      />
      <InvitePopup
        open={groupPopup}
        name={selected.map((u) => u.nickname || `${u.firstName || ''} ${u.lastName || ''}`.trim())}
        stake={stake}
        onStakeChange={setStake}
        group
        opponents={selected.map((u) => u.nickname || `${u.firstName || ''} ${u.lastName || ''}`.trim())}
        onAccept={() => {
          if (selected.length > 0) {
            const roomId = `invite-${accountId}-${Date.now()}-${selected.length + 1}`;
            socket.emit(
              'inviteGroup',
              {
                fromId: accountId,
                fromTelegramId: telegramId,
                fromName: myName,
                toIds: selected.map((u) => u.accountId),
                telegramIds: selected.map((u) => u.telegramId),
                opponentNames: selected.map((u) => u.nickname || `${u.firstName || ''} ${u.lastName || ''}`.trim()),
                roomId,
                token: stake.token,
                amount: stake.amount,
              },
              (res) => {
                if (res && res.success) {
                  window.location.href = `/games/snake?table=${roomId}&token=${stake.token}&amount=${stake.amount}`;
                } else {
                  alert(res?.error || 'Failed to send invite');
                }
              },
            );
          }
          setGroupPopup(false);
          setSelected([]);
        }}
        onReject={() => {
          setGroupPopup(false);
          setSelected([]);
        }}
      />
    </div>
  );
}
