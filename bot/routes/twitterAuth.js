import { Router } from 'express';
import { TwitterApi } from 'twitter-api-v2';

const router = Router();

const clientId = process.env.TWITTER_CLIENT_ID;
const clientSecret = process.env.TWITTER_CLIENT_SECRET;

const oauthStore = new Map();

if (!clientId || !clientSecret) {
  console.warn('Twitter OAuth not configured');
}

router.post('/start', async (req, res) => {
  const { telegramId } = req.body || {};
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Twitter OAuth not configured' });
  }
  try {
    const twitterClient = new TwitterApi({ appKey: clientId, appSecret: clientSecret });
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/twitter/callback`;
    const { url, oauth_token, oauth_token_secret } = await twitterClient.generateAuthLink(callbackUrl);
    oauthStore.set(oauth_token, { secret: oauth_token_secret, telegramId });
    res.json({ url });
  } catch (err) {
    console.error('twitter start failed:', err);
    res.status(500).json({ error: 'failed to start auth' });
  }
});

router.get('/callback', async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const entry = oauthStore.get(oauth_token);
  if (!entry) {
    return res.status(400).send('Invalid token');
  }
  try {
    const twitterClient = new TwitterApi({
      appKey: clientId,
      appSecret: clientSecret,
      accessToken: oauth_token,
      accessSecret: entry.secret,
    });
    const { client: loggedClient, accessToken, accessSecret, screenName, userId } = await twitterClient.login(oauth_verifier);
    oauthStore.delete(oauth_token);
    // Save the twitter handle via existing profile route
    await fetch(`${req.protocol}://${req.get('host')}/api/profile/link-social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: entry.telegramId, twitter: screenName }),
    });
    res.send('Twitter account linked. You can close this window.');
  } catch (err) {
    console.error('twitter callback failed:', err);
    res.status(500).send('Failed to link Twitter');
  }
});

export default router;
