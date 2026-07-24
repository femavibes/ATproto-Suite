// Discord webhook notifications

const WEBHOOKS = {
  alerts: process.env.DISCORD_WEBHOOK_ALERTS,
  users: process.env.DISCORD_WEBHOOK_USERS,
  errors: process.env.DISCORD_WEBHOOK_ERRORS,
};

async function sendDiscord(channel, content, embeds) {
  const url = WEBHOOKS[channel];
  if (!url) return;
  try {
    const body = {};
    if (content) body.content = content;
    if (embeds) body.embeds = embeds;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[discord] webhook failed:', channel, err.message);
  }
}

function notifyAlert(type, details) {
  const colors = { reported_image: 0xdc2626, image_request: 0xf59e0b, label_request: 0x3b82f6 };
  const titles = { reported_image: 'Image Reported', image_request: 'Image Permission Request', label_request: 'Label Request' };
  sendDiscord('alerts', null, [{
    title: titles[type] || 'New Alert',
    color: colors[type] || 0x666666,
    fields: Object.entries(details).filter(([, v]) => v).map(([k, v]) => ({
      name: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: String(v).slice(0, 200),
      inline: true,
    })),
    timestamp: new Date().toISOString(),
  }]);
}

async function notifyNewUser(handle, did, location) {
  const profileUrl = `https://bsky.app/profile/${handle}`;
  let avatar = null;
  try {
    const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`);
    if (res.ok) {
      const profile = await res.json();
      avatar = profile.avatar || null;
    }
  } catch {}
  sendDiscord('users', null, [{
    title: 'New ATlas User',
    color: 0x22c55e,
    url: profileUrl,
    ...(avatar ? { thumbnail: { url: avatar } } : {}),
    fields: [
      { name: 'Handle', value: `@${handle}`, inline: true },
      { name: 'DID', value: did.slice(0, 32) + '...', inline: true },
      ...(location ? [{ name: 'Location', value: location, inline: true }] : []),
    ],
    timestamp: new Date().toISOString(),
  }]);
}

function notifyError(source, message, details) {
  sendDiscord('errors', null, [{
    title: `Error: ${source}`,
    color: 0xdc2626,
    description: message.slice(0, 500),
    fields: details ? Object.entries(details).map(([k, v]) => ({
      name: k, value: String(v).slice(0, 200), inline: true,
    })) : [],
    timestamp: new Date().toISOString(),
  }]);
}

module.exports = { sendDiscord, notifyAlert, notifyNewUser, notifyError };
