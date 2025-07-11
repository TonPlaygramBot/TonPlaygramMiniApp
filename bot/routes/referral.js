import { Router } from 'express';
import User from '../models/User.js';
import { incrementReferralBonus } from '../utils/userUtils.js';

const router = Router();

router.post('/code', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const count = await User.countDocuments({ referredBy: user.referralCode });
  const storeRate =
    user.storeMiningRate && user.storeMiningExpiresAt &&
    user.storeMiningExpiresAt > new Date()
      ? user.storeMiningRate
      : 0;
  res.json({
    referralCode: user.referralCode,
    referralCount: count,
    bonusMiningRate: (user.bonusMiningRate || 0) + storeRate,
    storeMiningRate: storeRate,
    storeMiningExpiresAt: storeRate ? user.storeMiningExpiresAt : null,
  });
});

router.post('/claim', async (req, res) => {
  const { telegramId, code } = req.body;
  if (!telegramId || !code) {
    return res.status(400).json({ error: 'telegramId and code required' });
  }

  const inviter = await User.findOne({ referralCode: code });
  if (!inviter) return res.status(400).json({ error: 'invalid code' });

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (user.referredBy) {
    return res.json({ message: 'already claimed' });
  }
  if (user.referralCode === code) {
    return res.json({ message: 'cannot claim own code' });
  }

  user.referredBy = code;
  await user.save();

  await incrementReferralBonus(code);

  const count = await User.countDocuments({ referredBy: code });
  res.json({ message: 'claimed', total: count });
});

export default router;
