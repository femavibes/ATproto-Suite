async function emitOzoneLabel(did, createLabels, negateLabels, comment) {
  if (!process.env.OZONE_URL || !process.env.OZONE_ADMIN_PASSWORD) return;
  
  try {
    const response = await fetch(`${process.env.OZONE_URL}/xrpc/tools.ozone.moderation.emitEvent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`admin:${process.env.OZONE_ADMIN_PASSWORD}`).toString('base64')}`
      },
      body: JSON.stringify({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: createLabels,
          negateLabelVals: negateLabels,
          comment: comment || 'Label updated via web directory'
        },
        subject: { $type: 'com.atproto.admin.defs#repoRef', did },
        createdBy: process.env.LABELER_DID
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ozone API error (${response.status}):`, errorText);
    }
  } catch (e) {
    console.error('Ozone label emit failed:', e.message);
  }
}

module.exports = { emitOzoneLabel };
