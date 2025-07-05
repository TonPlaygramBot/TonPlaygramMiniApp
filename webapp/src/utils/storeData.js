export const STORE_ADDRESS = 'UQDqDBiNU132j15Qka5EmSf37jCTLF-RdOlaQOXLHIJ5t-XT';

export const STORE_CATEGORIES = [
  'Presale',
  'Spin & Win',
  'Virtual Friends',
  'Bonus Bundles'
];

export const STORE_BUNDLES = [
  { id: 'newbie', name: 'Newbie Pack', icon: '🌱', tpc: 25000, ton: 0.25, boost: 0, category: 'Presale' },
  { id: 'rookie', name: 'Rookie', icon: '🎯', tpc: 50000, ton: 0.4, boost: 0, category: 'Presale' },
  { id: 'starter', name: 'Starter', icon: '🚀', tpc: 100000, ton: 0.75, boost: 0, category: 'Presale' },
  { id: 'miner', name: 'Miner Pack', icon: '⛏️', tpc: 250000, ton: 1.6, boost: 0.03, category: 'Presale' },
  { id: 'grinder', name: 'Grinder', icon: '⚙️', tpc: 500000, ton: 3.0, boost: 0.05, category: 'Presale' },
  { id: 'pro', name: 'Pro Bundle', icon: '🏆', tpc: 1000000, ton: 5.5, boost: 0.08, category: 'Presale' },
  { id: 'whale', name: 'Whale Bundle', icon: '🐋', tpc: 2500000, ton: 10.5, boost: 0.12, category: 'Presale' },
  { id: 'max', name: 'Max Presale', icon: '👑', tpc: 5000000, ton: 20, boost: 0.15, category: 'Presale' },

  // Spin & Win Bundles
  { id: 'luckyStarter', name: 'Lucky Starter', icon: '🎁', tpc: 5000, ton: 0.25, spins: 3, category: 'Spin & Win' },
  { id: 'spinx3', name: 'Spin x3 Pack', icon: '🔁', tpc: 10000, ton: 0.4, spins: 5, category: 'Spin & Win' },
  { id: 'megaSpin', name: 'Mega Spin Pack', icon: '💎', tpc: 25000, ton: 1.0, spins: 15, category: 'Spin & Win' },

  // Virtual Friends (Mining Boosters)
  { id: 'lazyLarry', name: 'Lazy Larry', icon: '🐣', tpc: 0, ton: 0.15, boost: 0.25, duration: 7, category: 'Virtual Friends' },
  { id: 'smartSia', name: 'Smart Sia', icon: '🧠', tpc: 0, ton: 0.3, boost: 0.5, duration: 7, category: 'Virtual Friends' },
  { id: 'grindBot', name: 'GrindBot3000', icon: '🤖', tpc: 0, ton: 0.7, boost: 1.25, duration: 14, category: 'Virtual Friends' },

  // Bonus Bundles
  { id: 'powerPack', name: 'Power Pack', icon: '⚡', tpc: 20000, ton: 0.35, boost: 0.5, duration: 3, category: 'Bonus Bundles' },
  { id: 'proPack', name: 'Pro Pack', icon: '🎯', tpc: 40000, ton: 0.6, spins: 3, boost: 0.5, duration: 7, category: 'Bonus Bundles' },
  { id: 'galaxyPack', name: 'Galaxy Pack', icon: '🚀', tpc: 100000, ton: 1.2, spins: 5, boost: 1.25, duration: 7, category: 'Bonus Bundles' }
];
