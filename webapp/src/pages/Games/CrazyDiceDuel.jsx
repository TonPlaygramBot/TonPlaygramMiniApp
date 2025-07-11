import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DiceRoller from '../../components/DiceRoller.jsx';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import GameEndPopup from '../../components/GameEndPopup.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { chatBeep, timerBeep } from '../../assets/soundData.js';
import { getGameVolume, isGameMuted } from '../../utils/sound.js';
import { giftSounds } from '../../utils/giftSounds.js';

const COLORS = ['#60a5fa', '#ef4444', '#4ade80', '#facc15'];

export default function CrazyDiceDuel() {
  const navigate = useNavigate();
  const handleBack = useCallback(
    () => navigate('/games/crazydice/lobby', { replace: true }),
    [navigate],
  );
  useTelegramBackButton(handleBack);
  const [searchParams] = useSearchParams();
  const aiCount = parseInt(searchParams.get('ai')) || 0;
  const playerCount = aiCount > 0
    ? aiCount + 1
    : parseInt(searchParams.get('players')) || 2;
  const maxRolls = parseInt(searchParams.get('rolls')) || 1;

  const [bgUnlocked, setBgUnlocked] = useState(() =>
    localStorage.getItem('crazyDiceBgUnlocked') === 'true',
  );

  const unlockBackground = () => {
    localStorage.setItem('crazyDiceBgUnlocked', 'true');
    setBgUnlocked(true);
  };

  const initialPlayers = useMemo(
    () =>
      Array.from({ length: playerCount }, (_, i) => ({
        score: 0,
        rolls: 0,
        results: [],
        photoUrl:
          i === 0
            ? loadAvatar() || '/assets/icons/profile.svg'
            : `/assets/avatars/avatar${(i % 5) + 1}.svg`,
        color: COLORS[i % COLORS.length],
      })),
    [playerCount],
  );

  const [players, setPlayers] = useState(initialPlayers);
  const [current, setCurrent] = useState(0);
  const [trigger, setTrigger] = useState(0);
  const [winner, setWinner] = useState(null);
  const [tiePlayers, setTiePlayers] = useState(null);
  const ranking = useMemo(
    () =>
      players
        .map((p, i) => ({ name: i === 0 ? 'You' : `P${i + 1}`, score: p.score }))
        .sort((a, b) => b.score - a.score)
        .map((p) => p.name),
    [players],
  );
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [muted, setMuted] = useState(isGameMuted());
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef(null);
  const timerSoundRef = useRef(null);
  const diceRef = useRef(null);
  const boardRef = useRef(null);
  const [diceStyle, setDiceStyle] = useState({ display: 'none' });
  const DICE_SMALL_SCALE = 0.44;
  const DICE_ANIM_DURATION = 1800;
  const GRID_ROWS = 20;
  const GRID_COLS = 10;

  const PLAYER_DICE_CELLS = [
    ['E19', 'F19'],
    ['A8', 'B8'],
    ['E8', 'F8'],
    ['I8', 'J8'],
  ];

  const getCellCenter = (label) => {
    if (!boardRef.current) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const rect = boardRef.current.getBoundingClientRect();
    const col = label.charCodeAt(0) - 65;
    const row = parseInt(label.slice(1)) - 1;
    const x = rect.left + rect.width * ((col + 0.5) / GRID_COLS);
    const y = rect.top + rect.height * ((row + 0.5) / GRID_ROWS);
    return { x, y };
  };

  const getDiceCenter = () => {
    const p1 = getCellCenter('E12');
    const p2 = getCellCenter('F12');
    return { cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2 };
  };

  const getPlayerDicePos = (idx) => {
    const cells = PLAYER_DICE_CELLS[idx];
    if (!cells) return getDiceCenter();
    const p1 = getCellCenter(cells[0]);
    const p2 = getCellCenter(cells[1]);
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  };

  useEffect(() => {
    timerSoundRef.current = new Audio(timerBeep);
    timerSoundRef.current.volume = getGameVolume();
    return () => timerSoundRef.current?.pause();
  }, []);

  useEffect(() => {
    const handler = () => setMuted(isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerSoundRef.current?.pause();
    const isAI = aiCount > 0 && current > 0;
    if (isAI) {
      setTimeLeft(3.5);
      const end = Date.now() + 3500;
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, (end - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setTrigger((t) => t + 1);
        }
        setTimeLeft(remaining);
      }, 100);
      return () => clearInterval(timerRef.current);
    }
    setTimeLeft(15);
    const end = Date.now() + 15000;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, (end - Date.now()) / 1000);
      const isHumanTurn = aiCount === 0 || current === 0;
      if (
        isHumanTurn &&
        remaining <= 7 &&
        Math.ceil(remaining) !== Math.ceil(timeLeft) &&
        timerSoundRef.current
      ) {
        timerSoundRef.current.currentTime = 0;
        if (!muted) timerSoundRef.current.play().catch(() => {});
      }
      if (remaining <= 0) {
        timerSoundRef.current?.pause();
        clearInterval(timerRef.current);
        setTrigger((t) => t + 1);
      }
      setTimeLeft(remaining);
    }, 100);
    return () => {
      clearInterval(timerRef.current);
      timerSoundRef.current?.pause();
    };
  }, [current, aiCount, muted]);

  const handleRollEnd = (values) => {
    const value = Array.isArray(values) ? values.reduce((a, b) => a + b, 0) : values;
    setPlayers((prev) => {
      const nextPlayers = prev.map((p, idx) =>
        idx === current
          ? {
              ...p,
              score: p.score + value,
              rolls: p.rolls + 1,
              results: [...p.results, value],
            }
          : p
      );
      return nextPlayers;
    });
    let n = (current + 1) % players.length;
    while (players[n].rolls >= maxRolls) n = (n + 1) % players.length;
    animateDiceToPlayer(n);
  };

  const prepareDiceAnimation = (startIdx) => {
    if (startIdx == null) {
      const { cx, cy } = getDiceCenter();
      setDiceStyle({
        display: 'block',
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(1)`,
        transition: 'none',
        pointerEvents: 'none',
        zIndex: 50,
      });
      return;
    }
    const { x, y } = getPlayerDicePos(startIdx);
    setDiceStyle({
      display: 'block',
      position: 'fixed',
      left: '0px',
      top: '0px',
      transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${DICE_SMALL_SCALE})`,
      transition: 'none',
      pointerEvents: 'none',
      zIndex: 50,
    });
  };

  const animateDiceToCenter = (startIdx) => {
    const dice = diceRef.current;
    if (!dice) return;
    const { x, y } = getPlayerDicePos(startIdx);
    const { cx, cy } = getDiceCenter();
    dice.style.display = 'block';
    dice.style.position = 'fixed';
    dice.style.left = '0px';
    dice.style.top = '0px';
    dice.style.pointerEvents = 'none';
    dice.style.zIndex = '50';
    dice.animate(
      [
        { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${DICE_SMALL_SCALE})` },
        { transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(1)` },
      ],
      { duration: DICE_ANIM_DURATION, easing: 'ease-in-out' },
    ).onfinish = () => {
      setDiceStyle({
        display: 'block',
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(1)`,
        pointerEvents: 'none',
        zIndex: 50,
      });
    };
  };

  const animateDiceToPlayer = (idx) => {
    const dice = diceRef.current;
    if (!dice) return;
    const { x, y } = getPlayerDicePos(idx);
    const { cx, cy } = getDiceCenter();
    dice.animate(
      [
        { transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(1)` },
        { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${DICE_SMALL_SCALE})` },
      ],
      { duration: DICE_ANIM_DURATION, easing: 'ease-in-out' },
    ).onfinish = () => {
      setDiceStyle({
        display: 'block',
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${DICE_SMALL_SCALE})`,
        pointerEvents: 'none',
        zIndex: 50,
      });
    };
  };

  const nextTurn = () => {
    setCurrent((c) => {
      let n = (c + 1) % players.length;
      while (players[n].rolls >= maxRolls) n = (n + 1) % players.length;
      return n;
    });
  };

  const allRolled = players.every((p) => p.rolls >= maxRolls);

  if (winner == null && allRolled) {
    const max = Math.max(...players.map((p) => p.score));
    const leaders = players.filter((p) => p.score === max);
    if (leaders.length === 1) {
      setWinner(players.indexOf(leaders[0]));
    } else {
      // tie break
      setTiePlayers(leaders.map((p, idx) => players.indexOf(p)));
      setPlayers((prev) => prev.map((p) => ({ ...p, rolls: 0, results: [] })));
    }
    setCurrent(0);
    return null;
  }

  if (tiePlayers && players.every((p) => p.rolls >= maxRolls)) {
    const max = Math.max(...players.map((p) => p.score));
    const leaders = players.filter((p) => p.score === max);
    if (leaders.length === 1) {
      setWinner(players.indexOf(leaders[0]));
    } else {
      setPlayers((prev) => prev.map((p) => ({ ...p, rolls: 0, results: [] }))); 
    }
    setCurrent(0);
    return null;
  }

  const onRollEnd = (values) => {
    handleRollEnd(values);
    nextTurn();
  };

  const gridCells = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const label = `${String.fromCharCode(65 + c)}${r + 1}`;
      gridCells.push({ label });
    }
  }

  return (
    <div className="text-text relative">
      {bgUnlocked && (
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board crazy-dice-bg object-cover"
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <div className="crazy-dice-board" ref={boardRef}>
      {!bgUnlocked && (
        <button
          onClick={unlockBackground}
          className="absolute top-2 right-2 z-20 px-2 py-1 text-sm bg-primary hover:bg-primary-hover text-background rounded"
        >
          Unlock Background
        </button>
      )}
      <img
        src="/assets/icons/file_00000000d410620a8c1878be43e192a1.png"
        alt="board"
        className="board-bg"
      />
      <div className="grid-overlay">
        {gridCells.map((cell, i) => (
          <div key={i} className="grid-cell">
            {cell.label && <span className="grid-label">{cell.label}</span>}
          </div>
        ))}
      </div>
      <div className="side-number top">1</div>
      <div className="side-number bottom">2</div>
      <div className="side-number left">3</div>
      <div className="side-number right">4</div>
      <div className="dice-center">
        {winner == null ? (
          <div
            ref={diceRef}
            style={diceStyle}
            className="dice-travel flex flex-col items-center"
          >
            <DiceRoller
              onRollEnd={onRollEnd}
              onRollStart={() => {
                prepareDiceAnimation(current);
                animateDiceToCenter(current);
              }}
              trigger={trigger}
              clickable={aiCount === 0 || current === 0}
              showButton={aiCount === 0 || current === 0}
              diceContainerClassName="space-x-8"
              className="crazy-dice"
            />
          </div>
        ) : (
          <div className="text-2xl font-bold text-center">
            Player {winner + 1} wins!
          </div>
        )}
      </div>
      <div className="player-bottom z-10">
        <AvatarTimer
          index={0}
          photoUrl={players[0].photoUrl}
          active={current === 0}
          isTurn={current === 0}
          timerPct={current === 0 ? timeLeft / 15 : 1}
          name="You"
          score={players[0].score}
          rollHistory={players[0].results}
          maxRolls={maxRolls}
          color={players[0].color}
          onClick={() => {
            if (current === 0) setTrigger((t) => t + 1);
          }}
        />
      </div>
      {players.slice(1).map((p, i) => {
        const pos = ['player-left', 'player-center', 'player-right'][i] || '';
        return (
          <div key={i + 1} className={`${pos} z-10`}>
          <AvatarTimer
            index={i + 1}
            photoUrl={p.photoUrl}
            active={current === i + 1}
            isTurn={current === i + 1}
            timerPct={current === i + 1 ? timeLeft / 3.5 : 1}
            name={`P${i + 2}`}
            score={p.score}
            rollHistory={p.results}
            maxRolls={maxRolls}
            color={p.color}
            onClick={() => {
              if (current === i + 1) setTrigger((t) => t + 1);
            }}
          />
          </div>
        );
      })}
      {chatBubbles.map((b) => (
        <div key={b.id} className="chat-bubble">
          <span>{b.text}</span>
          <img src={b.photoUrl} className="w-6 h-6 rounded-full" />
        </div>
      ))}
      <BottomLeftIcons
        onInfo={() => {}}
        onChat={() => setShowChat(true)}
        onGift={() => setShowGift(true)}
      />
      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        onSend={(text) => {
          const id = Date.now();
          setChatBubbles((b) => [...b, { id, text, photoUrl: players[0].photoUrl }]);
          if (!muted) {
            const a = new Audio(chatBeep);
            a.volume = getGameVolume();
            a.play().catch(() => {});
          }
          setTimeout(() => setChatBubbles((b) => b.filter((bb) => bb.id !== id)), 3000);
        }}
      />
      <GiftPopup
        open={showGift}
        onClose={() => setShowGift(false)}
        players={players.map((p, i) => ({ ...p, index: i, name: `P${i + 1}` }))}
        senderIndex={0}
        onGiftSent={({ from, to, gift }) => {
          const start = document.querySelector(`[data-player-index="${from}"]`);
          const end = document.querySelector(`[data-player-index="${to}"]`);
          if (start && end) {
            const s = start.getBoundingClientRect();
            const e = end.getBoundingClientRect();
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            let icon;
            if (typeof gift.icon === 'string' && gift.icon.match(/\.(png|jpg|jpeg|webp|svg)$/)) {
              icon = document.createElement('img');
              icon.src = gift.icon;
              icon.className = 'w-6 h-6';
            } else {
              icon = document.createElement('div');
              icon.textContent = gift.icon;
              icon.style.fontSize = '24px';
            }
            icon.style.position = 'fixed';
            icon.style.left = '0px';
            icon.style.top = '0px';
            icon.style.pointerEvents = 'none';
            icon.style.transform = `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)`;
            icon.style.zIndex = '9999';
            document.body.appendChild(icon);
            const giftSound = giftSounds[gift.id];
            if (giftSound && !muted) {
              const a = new Audio(giftSound);
              a.volume = getGameVolume();
              a.play().catch(() => {});
            }
            const animation = icon.animate(
              [
                { transform: `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)` },
                { transform: `translate(${cx}px, ${cy}px) scale(3)`, offset: 0.5 },
                { transform: `translate(${e.left + e.width / 2}px, ${e.top + e.height / 2}px) scale(1)` },
              ],
              { duration: 3500, easing: 'linear' },
            );
            animation.onfinish = () => icon.remove();
          }
        }}
      />
      <GameEndPopup
        open={winner != null}
        ranking={ranking}
        onPlayAgain={() => window.location.reload()}
        onReturn={() => navigate('/games/crazydice/lobby')}
      />
      </div>
    </div>
  );
}
