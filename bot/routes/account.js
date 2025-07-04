import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';
import { ensureTransactionArray, calculateBalance } from '../utils/userUtils.js';
import bot from '../bot.js';
import { sendTransferNotification, sendTPCNotification } from '../utils/notifications.js';

const router = Router();

// Create or fetch account for a user
router.post('/create', async (req, res) => {
  const { telegramId } = req.body;

  let user;
  if (telegramId) {
    user = await User.findOne({ telegramId });
    if (!user) {
      user = new User({ telegramId, accountId: uuidv4(), referralCode: String(telegramId) });
      await user.save();
    } else if (!user.accountId) {
      user.accountId = uuidv4();
      await user.save();
    }
  } else {
    const id = uuidv4();
    user = new User({ accountId: id, referralCode: id });
    await user.save();
  }

  res.json({ accountId: user.accountId, balance: user.balance });
});

// Get balance by account id
router.post('/balance', async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  const balance = calculateBalance(user);
  if (user.balance !== balance) {
    user.balance = balance;
    try {
      await user.save();
    } catch (err) {
      console.error('Failed to update balance:', err.message);
    }
  }
  res.json({ balance });
});

// Send TPC between accounts
router.post('/send', async (req, res) => {
  const { fromAccount, toAccount, amount, note } = req.body;
  if (!fromAccount || !toAccount || typeof amount !== 'number') {
    return res.status(400).json({ error: 'fromAccount, toAccount and amount required' });
  }
  if (amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

  const sender = await User.findOne({ accountId: fromAccount });
  if (!sender) return res.status(404).json({ error: 'sender not found' });
  const feeSender = Math.round(amount * 0.02);
  const feeReceiver = Math.round(amount * 0.01);
  if (sender.balance < amount + feeSender) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  let receiver = await User.findOne({ accountId: toAccount });
  if (!receiver) {
    receiver = new User({ accountId: toAccount });
  }

  async function getDev(id) {
    if (!id) return null;
    let u = await User.findOne({ accountId: id });
    if (!u) u = new User({ accountId: id });
    return u;
  }

  const devMainId =
    process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID;
  const dev1Id =
    process.env.DEV_ACCOUNT_ID_1 || process.env.VITE_DEV_ACCOUNT_ID_1;
  const dev2Id =
    process.env.DEV_ACCOUNT_ID_2 || process.env.VITE_DEV_ACCOUNT_ID_2;

  const devMain = await getDev(devMainId);
  const dev1 = await getDev(dev1Id);
  const dev2 = await getDev(dev2Id);

  ensureTransactionArray(sender);
  ensureTransactionArray(receiver);
  if (devMain) ensureTransactionArray(devMain);
  if (dev1) ensureTransactionArray(dev1);
  if (dev2) ensureTransactionArray(dev2);

  const txDate = new Date();
  sender.balance -= amount + feeSender;
  receiver.balance = (receiver.balance || 0) + amount - feeReceiver;
  if (dev1) {
    dev1.balance = (dev1.balance || 0) + feeReceiver;
  } else if (devMain) {
    devMain.balance = (devMain.balance || 0) + feeReceiver;
  }
  if (dev2) {
    dev2.balance = (dev2.balance || 0) + feeSender;
  } else if (devMain) {
    devMain.balance = (devMain.balance || 0) + feeSender;
  }

  const safeNote = typeof note === 'string' ? note.slice(0, 150) : undefined;
  const senderTx = {
    amount: -(amount + feeSender),
    type: 'send',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    toAccount: toAccount,
    toName: receiver.nickname || receiver.firstName || '',
    ...(safeNote ? { detail: safeNote } : {})
  };
  const receiverTx = {
    amount: amount - feeReceiver,
    type: 'receive',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    fromAccount: fromAccount,
    fromName: sender.nickname || sender.firstName || '',
    ...(safeNote ? { detail: safeNote } : {})
  };
  const devTxs = [];
  if (dev1 || devMain) {
    const target = dev1 ? dev1Id : devMainId;
    devTxs.push({
      amount: feeReceiver,
      type: 'fee',
      token: 'TPC',
      status: 'delivered',
      date: txDate,
      fromAccount: fromAccount,
      toAccount: target,
    });
  }
  if (dev2 || devMain) {
    const target = dev2 ? dev2Id : devMainId;
    devTxs.push({
      amount: feeSender,
      type: 'fee',
      token: 'TPC',
      status: 'delivered',
      date: txDate,
      fromAccount: fromAccount,
      toAccount: target,
    });
  }
  sender.transactions.push(senderTx);
  receiver.transactions.push(receiverTx);
  for (const tx of devTxs) {
    if (dev1 && tx.toAccount === dev1Id) dev1.transactions.push(tx);
    else if (dev2 && tx.toAccount === dev2Id) dev2.transactions.push(tx);
    else if (devMain && tx.toAccount === devMainId) devMain.transactions.push(tx);
  }

  await sender.save();
  await receiver.save();
  if (devMain) await devMain.save();
  if (dev1) await dev1.save();
  if (dev2) await dev2.save();

  const devIds = [
    process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID,
    process.env.DEV_ACCOUNT_ID_1 || process.env.VITE_DEV_ACCOUNT_ID_1,
    process.env.DEV_ACCOUNT_ID_2 || process.env.VITE_DEV_ACCOUNT_ID_2,
  ].filter(Boolean);

  if (receiver.telegramId && !devIds.includes(toAccount)) {
    try {
      await sendTransferNotification(bot, receiver.telegramId, fromAccount, amount, safeNote);
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }

  res.json({ balance: sender.balance, transaction: senderTx });
});

// List transactions by account id
router.post('/transactions', async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  ensureTransactionArray(user);
  res.json({ transactions: user.transactions });
});

// Deposit rewards into account
router.post('/deposit', authenticate, async (req, res) => {
  const { accountId, amount, game } = req.body;
  const authId = req.auth?.telegramId;
  const devIds = [
    process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID,
    process.env.DEV_ACCOUNT_ID_1 || process.env.VITE_DEV_ACCOUNT_ID_1,
    process.env.DEV_ACCOUNT_ID_2 || process.env.VITE_DEV_ACCOUNT_ID_2,
  ].filter(Boolean);
  if (!accountId || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'accountId and positive amount required' });
  }
  let user = await User.findOne({ accountId });
  if (!user) {
    user = new User({ accountId });
    if (authId && !devIds.includes(accountId)) user.telegramId = authId;
  }
  if (!devIds.includes(accountId) && authId && user.telegramId && authId !== user.telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  ensureTransactionArray(user);
  user.balance += amount;
  const tx = {
    amount,
    type: 'deposit',
    token: 'TPC',
    status: 'delivered',
    date: new Date()
  };
  if (game) tx.game = game;
  user.transactions.push(tx);
  await user.save();

  if (user.telegramId && !devIds.includes(accountId)) {
    try {
      await sendTPCNotification(
        bot,
        user.telegramId,
        `\u{1FA99} Your deposit of ${amount} TPC was credited`
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }
  res.json({ balance: user.balance, transaction: tx });
});

export default router;
