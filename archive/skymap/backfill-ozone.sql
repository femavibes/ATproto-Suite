-- Backfill missing labels from ATlas DB to Ozone DB
-- This inserts labels that exist in user_labels but not in Ozone's label table

INSERT INTO label (src, uri, cid, val, neg, cts, "signingKeyId")
SELECT 
  'did:plc:l37i5se642dgeb7kmrdwoqv4' as src,
  ul.did as uri,
  '' as cid,
  LOWER(COALESCE(l.display_key, l.key)) as val,
  false as neg,
  NOW()::text as cts,
  1 as signingKeyId
FROM dblink(
  'host=localhost port=5435 dbname=skymap user=dev password=devpass',
  'SELECT ul.did, l.key, l.display_key 
   FROM user_labels ul 
   JOIN locations l ON ul.location_id = l.id 
   WHERE ul.active = true'
) AS atlas_labels(did text, key text, display_key text)
JOIN LATERAL (SELECT atlas_labels.did, atlas_labels.key, atlas_labels.display_key) ul ON true
JOIN LATERAL (SELECT atlas_labels.key, atlas_labels.display_key) l ON true
WHERE NOT EXISTS (
  SELECT 1 FROM label 
  WHERE label.uri = ul.did 
    AND label.val = LOWER(COALESCE(l.display_key, l.key))
    AND label.neg = false
)
ON CONFLICT (src, uri, cid, val) DO NOTHING;
