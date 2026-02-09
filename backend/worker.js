/**
 * Production Ready Cloudflare Worker
 * 
 * Required Environment Variables (via wrangler.toml):
 * - BUCKET_NAME, ACCOUNT_ID
 * - MAILGUN_DOMAIN, MAILGUN_FROM_EMAIL
 * - ALLOWED_ORIGINS, PUBLIC_DOMAIN
 * - SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY (optional, can be set via secrets)
 * 
 * Required Secrets (via wrangler secret):
 * - R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * - MAILGUN_API_KEY
 * - SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY (if not in vars)
 * 
 * Uses S3-compatible API for presigned URLs (supports large files with multipart upload)
 */

import { AwsClient } from 'aws4fetch';

const ALLOWED_TYPES = new Set([
  'application/json', 'application/octet-stream',
  'model/gltf-binary', 'model/gltf+json',
  'application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz',
  'image/png', 'image/jpeg', 'binary/octet-stream',
  'application/dxf', // DXF files
  'application/x-dxf', // Alternative DXF MIME type
  'application/zip', // Shapefile ZIPs
  'application/x-zip-compressed', // Alternative ZIP MIME type
  'application/vnd.laszip', // LAS/LAZ files
  'application/octet-stream' // Generic binary (covers LAS/LAZ)
]);

/**
 * Get GCP Access Token using Service Account credentials
 * Uses JWT-based authentication for Cloud Run Jobs API
 */
async function getGCPAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // Create JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: serviceAccount.private_key_id
  };

  // Create JWT payload
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
    scope: 'https://www.googleapis.com/auth/cloud-platform'
  };

  // Base64URL encode
  const base64url = (obj) => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const unsignedToken = `${base64url(header)}.${base64url(payload)}`;

  // Import private key and sign
  const privateKey = serviceAccount.private_key;
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${unsignedToken}.${signatureBase64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`GCP token exchange failed: ${errorText}`);
  }

  return tokenResponse.json();
}

export default {
  async fetch(request, env, ctx) {
    // CORS Handling
    const origin = request.headers.get("Origin");
    const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : ['*'];
    const isAllowedOrigin = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin));
    const corsHeaders = {
      "Access-Control-Allow-Origin": isAllowedOrigin && origin ? origin : "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Debug logging
    console.log('Request:', {
      method: request.method,
      pathname: url.pathname,
      url: url.href
    });

    try {
      // --- 1. PRESIGNED URL GENERATION (S3-compatible for large files) ---
      if (request.method === 'POST' && (url.pathname === '/presign' || url.pathname === '/')) {
        let requestBody;
        try {
          requestBody = await request.json();
        } catch (e) {
          console.error('JSON parse error:', e);
          return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const { key, type, uploadId, partNumber } = requestBody;

        if (!key) {
          return new Response(JSON.stringify({ error: "Missing key parameter" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Validate required env variables
        if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.ACCOUNT_ID || !env.BUCKET_NAME) {
          console.error('Missing R2 config:', {
            hasAccessKey: !!env.R2_ACCESS_KEY_ID,
            hasSecretKey: !!env.R2_SECRET_ACCESS_KEY,
            hasAccountId: !!env.ACCOUNT_ID,
            hasBucketName: !!env.BUCKET_NAME
          });
          return new Response(JSON.stringify({ error: "R2 configuration missing" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        try {
          // Create AWS client for R2 (S3-compatible API)
          const client = new AwsClient({
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          });

          // R2 S3-compatible endpoint (using EU regional endpoint for better stability)
          const accountId = env.ACCOUNT_ID;
          const bucketName = env.BUCKET_NAME;
          const objectKey = key;

          let r2Url = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;

          // If partNumber and uploadId are present, it's a Part Upload
          if (partNumber && uploadId) {
            r2Url += `?partNumber=${partNumber}&uploadId=${uploadId}`;
          }

          const signedRequest = new Request(r2Url, {
            method: 'PUT',
            headers: {
              'Content-Type': type || 'application/octet-stream'
            }
          });

          // Sign the request with query parameters (presigned URL)
          const signed = await client.sign(signedRequest, {
            aws: {
              signQuery: true,
              service: 's3',
              region: 'auto',
            }
          });

          // Get the signed URL from the Request object
          // signed is a Request object, so we can access .url directly
          const presignedUrl = signed.url;

          if (!presignedUrl) {
            throw new Error('Failed to extract presigned URL from signed request');
          }

          // Generate public URL (use original key, not encoded)
          const publicUrl = env.PUBLIC_DOMAIN
            ? `${env.PUBLIC_DOMAIN}/${key}`
            : `https://pub-${accountId}.r2.dev/${key}`;

          return new Response(JSON.stringify({
            uploadUrl: presignedUrl,
            publicUrl: publicUrl
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (signError) {
          console.error('Presign URL creation error:', signError);
          return new Response(JSON.stringify({
            error: "Failed to create presigned URL",
            details: signError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // --- 1.1 MULTIPART UPLOAD: START ---
      if (url.pathname === '/multipart/start' && request.method === 'POST') {
        const { key, type } = await request.json();
        const client = new AwsClient({
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        });

        const r2Url = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}/${key}?uploads`;
        const startRequest = new Request(r2Url, {
          method: 'POST',
          headers: { 'Content-Type': type || 'application/octet-stream' }
        });
        const signedStart = await client.sign(startRequest, { aws: { service: 's3', region: 'auto' } });
        const response = await fetch(signedStart);
        const xml = await response.text();

        const uploadIdMatch = xml.match(/<UploadId>([^<]+)<\/UploadId>/);
        if (!uploadIdMatch) {
          return new Response(JSON.stringify({ error: "Failed to start multipart upload", details: xml }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ uploadId: uploadIdMatch[1] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // --- 1.2 MULTIPART UPLOAD: COMPLETE ---
      if (url.pathname === '/multipart/complete' && request.method === 'POST') {
        const { key, uploadId, parts } = await request.json();
        const client = new AwsClient({
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        });

        // Build ETag XML
        let xml = '<CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/">';
        for (const part of parts) {
          xml += `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${part.etag}</ETag></Part>`;
        }
        xml += '</CompleteMultipartUpload>';

        const r2Url = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}/${key}?uploadId=${uploadId}`;
        const completeRequest = new Request(r2Url, {
          method: 'POST',
          body: xml,
          headers: { 'Content-Type': 'application/xml' }
        });

        const signedComplete = await client.sign(completeRequest, { aws: { service: 's3', region: 'auto' } });
        const response = await fetch(signedComplete);

        if (!response.ok) {
          const errorText = await response.text();
          return new Response(JSON.stringify({ error: "Failed to complete upload", details: errorText }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const publicUrl = env.PUBLIC_DOMAIN
          ? `${env.PUBLIC_DOMAIN}/${key}`
          : `https://pub-${env.ACCOUNT_ID}.r2.dev/${key}`;

        return new Response(JSON.stringify({ success: true, publicUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (url.pathname === '/send-share-email' && request.method === 'POST') {
        console.log('send-share-email endpoint hit');
        try {
          let requestBody;
          try {
            requestBody = await request.json();
          } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          const { to, pin, shareLink, assetName, fromEmail, fromName, hours } = requestBody;

          // Calculate expiration in days for email display
          const expiresHours = hours || 168; // default 7 days
          const expiresDays = Math.round(expiresHours / 24);
          const expirationText = expiresDays === 1 ? '1 day' : `${expiresDays} days`;

          if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
            console.error('Mailgun config missing:', {
              hasApiKey: !!env.MAILGUN_API_KEY,
              hasDomain: !!env.MAILGUN_DOMAIN
            });
            return new Response(JSON.stringify({ error: "Mail configuration missing" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          if (!to || !pin || !shareLink) {
            return new Response(JSON.stringify({ error: "Missing required fields: to, pin, shareLink" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          const formData = new FormData();

          // Dinamik from email: request body'den al, yoksa env'den default kullan
          let fromAddress;
          if (fromEmail) {
            // fromEmail varsa, fromName ile birlikte kullan
            fromAddress = fromName
              ? `${fromName} <${fromEmail}>`
              : fromEmail;
          } else {
            // Default fallback: env'den veya domain'den
            fromAddress = env.MAILGUN_FROM_EMAIL || `HekaMap Muhendislik <project@${env.MAILGUN_DOMAIN}>`;
          }

          formData.append('from', fromAddress);
          formData.append('to', to);
          formData.append('subject', `Secure Access: ${assetName || 'Shared Asset'}`);
          formData.append('text', `You have been granted secure access to "${assetName || 'a shared asset'}".\n\nLink: ${shareLink}\nPIN: ${pin}\n\nThis link expires in ${expirationText}.`);

          // Mailgun EU region support (use api.eu.mailgun.net for EU region)
          const mailgunRegion = env.MAILGUN_REGION === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
          const mailgunUrl = `https://${mailgunRegion}/v3/${env.MAILGUN_DOMAIN}/messages`;

          const mgResp = await fetch(mailgunUrl, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa('api:' + env.MAILGUN_API_KEY)
            },
            body: formData
          });

          if (!mgResp.ok) {
            const errorText = await mgResp.text();
            console.error('Mailgun error:', errorText);
            return new Response(JSON.stringify({
              error: `Mailgun failed: ${mgResp.status}`,
              details: errorText
            }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          const responseData = await mgResp.json();

          return new Response(JSON.stringify({ success: true, mailgunId: responseData.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (mailError) {
          console.error('Send email error:', mailError);
          return new Response(JSON.stringify({
            error: "Failed to send email",
            details: mailError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // --- 3. VERIFY SHARE PIN ---
      if (url.pathname === '/verify-share' && request.method === 'POST') {
        console.log('=== VERIFY-SHARE ENDPOINT HIT ===');
        try {
          let requestBody;
          try {
            requestBody = await request.json();
            console.log('Request body parsed:', { shareId: requestBody?.shareId, hasPin: !!requestBody?.pin });
          } catch (e) {
            console.error('Failed to parse request body:', e);
            return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          const { shareId, pin } = requestBody;
          console.log('Extracted shareId and pin:', { shareId, hasPin: !!pin });

          if (!shareId || !pin) {
            return new Response(JSON.stringify({ error: "Missing shareId or pin" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          // Check if Supabase is configured
          const supabaseUrl = env.SUPABASE_URL;
          const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

          if (!supabaseUrl || !supabaseKey) {
            console.error('Supabase config missing:', {
              hasUrl: !!supabaseUrl,
              hasKey: !!supabaseKey
            });
            return new Response(JSON.stringify({ error: "Supabase not configured" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          // Query Supabase for shared_links
          // Get shared link info including project_id and asset_ids for project shares
          // Use ISO date string for expiration check (PostgREST doesn't support now() function)
          const currentTime = new Date().toISOString();
          const shareResponse = await fetch(
            `${supabaseUrl}/rest/v1/shared_links?id=eq.${shareId}&expires_at=gt.${currentTime}&select=*`,
            {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (!shareResponse.ok) {
            throw new Error(`Supabase query failed: ${shareResponse.status}`);
          }

          const shareData = await shareResponse.json();

          console.log('Supabase share query result:', {
            status: shareResponse.status,
            dataLength: shareData ? shareData.length : 0,
            shareId: shareId
          });

          if (!shareData || shareData.length === 0) {
            console.error('Share ID not found or expired:', shareId);
            return new Response(JSON.stringify({ error: "Invalid share ID or expired" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          const shareLink = shareData[0];

          console.log('Share link found:', {
            id: shareLink.id,
            project_id: shareLink.project_id,
            asset_id: shareLink.asset_id,
            asset_ids: shareLink.asset_ids,
            asset_ids_type: typeof shareLink.asset_ids,
            has_pin_hash: !!shareLink.pin_hash
          });

          // Simple PIN verification - hash the input pin and compare
          // Support both hashed and plain PIN (for backward compatibility)
          const pinStr = String(pin);
          const pinHash = btoa(pinStr).replace(/[^a-zA-Z0-9]/g, '');

          console.log('PIN verification:', {
            providedPin: pinStr,
            providedHash: pinHash,
            storedHash: shareLink.pin_hash,
            storedPin: shareLink.pin
          });

          const pinMatch = shareLink.pin_hash === pinHash ||
            shareLink.pin_hash === pinStr ||
            shareLink.pin === pinStr; // Support direct pin field

          if (!pinMatch) {
            console.error('PIN mismatch:', {
              provided: pinStr,
              expectedHash: shareLink.pin_hash,
              expectedPin: shareLink.pin
            });
            return new Response(JSON.stringify({ error: "Invalid PIN" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          console.log('PIN verified successfully');

          // Check if this is a project share or single asset share
          if (shareLink.project_id) {
            // PROJECT SHARE: Get all selected assets from asset_ids array
            // asset_ids might be a JSONB array string, parse if needed
            let assetIds = shareLink.asset_ids || [];

            // If asset_ids is a string, parse it as JSON
            if (typeof assetIds === 'string') {
              try {
                assetIds = JSON.parse(assetIds);
              } catch (e) {
                console.error('Failed to parse asset_ids as JSON:', e);
                assetIds = [];
              }
            }

            // Ensure it's an array
            if (!Array.isArray(assetIds)) {
              console.error('asset_ids is not an array:', assetIds, typeof assetIds);
              assetIds = [];
            }

            console.log('Project share detected:', {
              project_id: shareLink.project_id,
              asset_ids: assetIds,
              asset_ids_length: assetIds.length,
              asset_ids_type: typeof assetIds
            });

            if (assetIds.length === 0) {
              console.error('No assets selected for sharing');
              return new Response(JSON.stringify({ error: "No assets selected for sharing" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              });
            }

            // Build query for multiple asset IDs (Supabase 'in' operator)
            // Supabase PostgREST requires UUIDs to be properly formatted
            // Try with quoted UUIDs first, if that doesn't work, try without quotes
            const assetIdsParam = assetIds.map(id => `"${id}"`).join(',');
            const queryUrl = `${supabaseUrl}/rest/v1/assets?id=in.(${assetIdsParam})&select=*`;

            console.log('Fetching assets:', {
              url: queryUrl,
              asset_ids: assetIds,
              asset_ids_count: assetIds.length
            });

            const assetResponse = await fetch(queryUrl, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              }
            });

            console.log('Asset fetch response status:', {
              status: assetResponse.status,
              statusText: assetResponse.statusText,
              ok: assetResponse.ok,
              headers: Object.fromEntries(assetResponse.headers.entries())
            });

            let assetData;

            if (!assetResponse.ok) {
              const errorText = await assetResponse.text();
              console.error('Failed to fetch assets with quoted UUIDs:', {
                status: assetResponse.status,
                error: errorText,
                url: queryUrl
              });

              // Try alternative query format without quotes
              console.log('Trying alternative query format (without quotes)...');
              const altAssetIdsParam = assetIds.join(',');
              const altQueryUrl = `${supabaseUrl}/rest/v1/assets?id=in.(${altAssetIdsParam})&select=*`;

              const altAssetResponse = await fetch(altQueryUrl, {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                }
              });

              console.log('Alternative query response status:', {
                status: altAssetResponse.status,
                ok: altAssetResponse.ok
              });

              if (!altAssetResponse.ok) {
                const altErrorText = await altAssetResponse.text();
                console.error('Alternative query also failed:', {
                  status: altAssetResponse.status,
                  error: altErrorText
                });
                throw new Error(`Failed to fetch assets: ${assetResponse.status}`);
              }

              assetData = await altAssetResponse.json();
              console.log('Alternative query succeeded!', { count: assetData ? assetData.length : 0 });
            } else {
              assetData = await assetResponse.json();
            }

            console.log('Assets fetched:', {
              count: assetData ? assetData.length : 0,
              asset_ids_received: assetData ? assetData.map(a => a.id) : [],
              asset_ids_expected: assetIds,
              query_url: queryUrl
            });

            // Check if any assets were found
            if (!assetData || assetData.length === 0) {
              console.error('No assets found for IDs:', {
                expected_ids: assetIds,
                query_url: queryUrl,
                response_status: assetResponse.status,
                possible_issue: 'RLS policy might be blocking access or assets do not exist'
              });

              // Try fetching a single asset to test RLS
              if (assetIds.length > 0) {
                const testId = assetIds[0];
                const testUrl = `${supabaseUrl}/rest/v1/assets?id=eq.${testId}&select=*`;
                console.log('Testing single asset fetch for RLS check:', testUrl);

                const testResponse = await fetch(testUrl, {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                  }
                });

                const testData = await testResponse.json();
                console.log('Single asset test result:', {
                  status: testResponse.status,
                  found: testData && testData.length > 0,
                  count: testData ? testData.length : 0
                });
              }

              return new Response(JSON.stringify({ error: "Assets not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              });
            }

            // Format assets for response (preserve order from asset_ids array)
            // All assets default to invisible (unseen) in secure viewer for better security
            const orderedAssets = assetIds
              .map(id => assetData.find(a => a.id === id))
              .filter(Boolean)
              .map(asset => ({
                id: asset.id,
                project_id: asset.project_id || 'shared',
                name: asset.name,
                type: asset.type,
                storage_path: asset.storage_path || '',
                url: asset.storage_path || '',
                visible: false, // Default unseen - user can toggle visibility manually
                opacity: 1,
                position: asset.position || null,
                data: asset.data || null,
                height_offset: asset.height_offset || 0, // Include saved height offset
                scale: asset.scale || 1 // Include saved scale
              }));

            return new Response(JSON.stringify({
              success: true,
              layers: orderedAssets,
              projectName: shareLink.project_name || 'Shared Project'
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          } else {
            // SINGLE ASSET SHARE: Get the single shared asset (legacy support)
            const assetResponse = await fetch(
              `${supabaseUrl}/rest/v1/assets?id=eq.${shareLink.asset_id}&select=*`,
              {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!assetResponse.ok) {
              throw new Error(`Failed to fetch asset: ${assetResponse.status}`);
            }

            const assetData = await assetResponse.json();

            if (!assetData || assetData.length === 0) {
              return new Response(JSON.stringify({ error: "Asset not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              });
            }

            // Legacy single asset share response
            const asset = assetData[0];

            // Get all assets (including measurements/annotations) for the same project
            const assetsResponse = await fetch(
              `${supabaseUrl}/rest/v1/assets?project_id=eq.${asset.project_id}&select=*`,
              {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!assetsResponse.ok) {
              throw new Error(`Failed to fetch assets: ${assetsResponse.status}`);
            }

            const allAssets = await assetsResponse.json();

            // Format layers for response
            // All assets default to invisible (unseen) in secure viewer for better security
            const layers = allAssets.map(a => ({
              id: a.id,
              name: a.name,
              type: a.type,
              url: a.storage_path || null,
              visible: false, // Default unseen - user can toggle visibility manually
              opacity: 1,
              position: a.position || null,
              data: a.data || null,
              height_offset: a.height_offset || 0, // Include saved height offset
              scale: a.scale || 1 // Include saved scale
            }));

            return new Response(JSON.stringify({ layers }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

        } catch (e) {
          console.error('Verify share error:', e);
          return new Response(JSON.stringify({
            error: "Internal server error",
            details: e.message || String(e)
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // --- 4. DELETE FILE FROM R2 ---
      if (url.pathname === '/delete' && request.method === 'POST') {
        console.log('=== DELETE ENDPOINT HIT ===');

        let requestBody;
        try {
          requestBody = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const { key, isPrefix } = requestBody;
        console.log('Delete request:', { key, isPrefix });

        if (!key) {
          return new Response(JSON.stringify({ error: "Missing key parameter" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Validate required env variables
        if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.ACCOUNT_ID || !env.BUCKET_NAME) {
          console.error('Missing R2 config for delete');
          return new Response(JSON.stringify({ error: "R2 configuration missing" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        try {
          // Create AWS client for R2 (S3-compatible API)
          const client = new AwsClient({
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          });

          // Extract key from URL if it's a full URL
          let objectKey = key;
          if (key.startsWith('http')) {
            console.log('Extracting key from URL:', key);
            const urlObj = new URL(key);

            // Get the pathname (everything after the domain)
            // Remove leading slash
            objectKey = urlObj.pathname.substring(1);

            // Handle different URL formats:
            // 1. Custom domain: https://cdn.domain.com/uploads/file.kml -> uploads/file.kml
            // 2. R2 dev domain: https://pub-xxx.r2.dev/uploads/file.kml -> uploads/file.kml
            // The pathname already gives us the correct key after removing leading /

            console.log('Extracted objectKey from pathname:', objectKey);
          }

          // For 3D Tiles (prefix deletion) - delete all files under this prefix
          if (isPrefix) {
            console.log('Prefix deletion mode for:', objectKey);

            // Extract the folder prefix from tileset.json URL
            // e.g., uploads/tilesets/123-name/folder/tileset.json -> uploads/tilesets/123-name/folder/
            const prefixMatch = objectKey.match(/^(uploads\/tilesets\/[^\/]+\/[^\/]+\/)/);
            let prefix = prefixMatch ? prefixMatch[1] : objectKey.replace(/[^\/]+$/, '');

            // If the key ends with tileset.json, get parent folder
            if (objectKey.endsWith('tileset.json')) {
              prefix = objectKey.replace(/tileset\.json$/, '');
            }

            console.log('Deleting all files with prefix:', prefix);

            // List all objects with this prefix
            const listUrl = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}?list-type=2&prefix=${encodeURIComponent(prefix)}`;

            const listRequest = new Request(listUrl, {
              method: 'GET'
            });

            const signedList = await client.sign(listRequest, {
              aws: { service: 's3', region: 'auto' }
            });

            const listResponse = await fetch(signedList);

            if (!listResponse.ok) {
              console.error('Failed to list objects:', listResponse.status);
              throw new Error(`Failed to list objects: ${listResponse.status}`);
            }

            const listXml = await listResponse.text();
            console.log('List response received, parsing...');

            // Parse XML to get object keys
            // Simple XML parsing for <Key>...</Key> elements
            const keyMatches = listXml.matchAll(/<Key>([^<]+)<\/Key>/g);
            const keysToDelete = [];
            for (const match of keyMatches) {
              keysToDelete.push(match[1]);
            }

            console.log('Found objects to delete:', keysToDelete.length);

            if (keysToDelete.length === 0) {
              console.log('No objects found with prefix, returning success');
              return new Response(JSON.stringify({ success: true, deleted: 0 }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              });
            }

            // Delete objects in parallel batches for speed
            let totalDeleted = 0;
            let totalErrors = 0;
            const PARALLEL_BATCH_SIZE = 50; // 50 concurrent deletes

            for (let i = 0; i < keysToDelete.length; i += PARALLEL_BATCH_SIZE) {
              const batch = keysToDelete.slice(i, i + PARALLEL_BATCH_SIZE);

              const deletePromises = batch.map(async (keyToDelete) => {
                try {
                  // Properly encode each path segment to handle special characters
                  const encodedKey = keyToDelete.split('/').map(segment => encodeURIComponent(segment)).join('/');
                  const singleDeleteUrl = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}/${encodedKey}`;

                  const singleDeleteRequest = new Request(singleDeleteUrl, {
                    method: 'DELETE'
                  });

                  const signedSingleDelete = await client.sign(singleDeleteRequest, {
                    aws: { service: 's3', region: 'auto' }
                  });

                  const singleDeleteResponse = await fetch(signedSingleDelete);

                  if (singleDeleteResponse.ok || singleDeleteResponse.status === 404) {
                    return { success: true };
                  } else {
                    return { success: false, status: singleDeleteResponse.status, key: keyToDelete };
                  }
                } catch (e) {
                  return { success: false, error: e.message, key: keyToDelete };
                }
              });

              const results = await Promise.allSettled(deletePromises);

              for (const result of results) {
                if (result.status === 'fulfilled' && result.value.success) {
                  totalDeleted++;
                } else {
                  totalErrors++;
                }
              }

              console.log(`Batch ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1}: deleted so far: ${totalDeleted}`);
            }

            console.log(`Prefix deletion complete: ${totalDeleted} deleted, ${totalErrors} errors`);
            return new Response(JSON.stringify({ success: true, deleted: totalDeleted, errors: totalErrors }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          // Single file deletion
          console.log('Single file deletion for:', objectKey);

          // Properly encode each path segment to handle special characters
          const encodedObjectKey = objectKey.split('/').map(segment => encodeURIComponent(segment)).join('/');

          // R2 S3-compatible endpoint for DELETE
          const r2Url = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}/${encodedObjectKey}`;

          const deleteRequest = new Request(r2Url, {
            method: 'DELETE'
          });

          // Sign the request
          const signed = await client.sign(deleteRequest, {
            aws: {
              service: 's3',
              region: 'auto', // R2 uses 'auto' region
            }
          });

          const deleteResponse = await fetch(signed);
          console.log('Delete response status:', deleteResponse.status);

          if (!deleteResponse.ok && deleteResponse.status !== 404) {
            throw new Error(`R2 delete failed: ${deleteResponse.status}`);
          }

          return new Response(JSON.stringify({ success: true, deleted: 1 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (deleteError) {
          console.error('Delete error:', deleteError);
          return new Response(JSON.stringify({
            error: "Failed to delete file",
            details: deleteError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // --- 5. LIST R2 FILES (for debugging and sync verification) ---
      if (url.pathname === '/list-r2' && request.method === 'GET') {
        console.log('=== LIST-R2 ENDPOINT HIT ===');

        // Validate required env variables
        if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.ACCOUNT_ID || !env.BUCKET_NAME) {
          return new Response(JSON.stringify({ error: "R2 configuration missing" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        try {
          const client = new AwsClient({
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          });

          const prefix = url.searchParams.get('prefix') || 'uploads/';
          const maxKeys = url.searchParams.get('limit') || '1000';

          const listUrl = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=${maxKeys}`;

          const listRequest = new Request(listUrl, {
            method: 'GET'
          });

          const signedList = await client.sign(listRequest, {
            aws: { service: 's3', region: 'auto' }
          });

          const listResponse = await fetch(signedList);

          if (!listResponse.ok) {
            throw new Error(`Failed to list objects: ${listResponse.status}`);
          }

          const listXml = await listResponse.text();

          // Parse XML to get object info
          const files = [];
          const keyMatches = listXml.matchAll(/<Key>([^<]+)<\/Key>/g);
          const sizeMatches = listXml.matchAll(/<Size>([^<]+)<\/Size>/g);
          const lastModifiedMatches = listXml.matchAll(/<LastModified>([^<]+)<\/LastModified>/g);

          const keys = [...keyMatches].map(m => m[1]);
          const sizes = [...sizeMatches].map(m => parseInt(m[1]));
          const lastModified = [...lastModifiedMatches].map(m => m[1]);

          for (let i = 0; i < keys.length; i++) {
            files.push({
              key: keys[i],
              size: sizes[i] || 0,
              lastModified: lastModified[i] || null,
              publicUrl: env.PUBLIC_DOMAIN
                ? `${env.PUBLIC_DOMAIN}/${keys[i]}`
                : `https://pub-${env.ACCOUNT_ID}.r2.dev/${keys[i]}`
            });
          }

          console.log('Listed files:', files.length);

          return new Response(JSON.stringify({
            success: true,
            count: files.length,
            files
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (listError) {
          console.error('List R2 error:', listError);
          return new Response(JSON.stringify({
            error: "Failed to list R2 files",
            details: listError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // --- 6. STORAGE STATS (for storage usage bar) ---
      if (url.pathname === '/storage-stats' && request.method === 'GET') {
        console.log('=== STORAGE-STATS ENDPOINT HIT ===');

        // Validate required env variables
        if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.ACCOUNT_ID || !env.BUCKET_NAME) {
          return new Response(JSON.stringify({ error: "R2 configuration missing" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        try {
          const client = new AwsClient({
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          });

          let totalBytes = 0;
          let fileCount = 0;
          let continuationToken = null;

          // Iterate through all objects (pagination)
          do {
            let listUrl = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}?list-type=2&prefix=uploads/&max-keys=1000`;
            if (continuationToken) {
              listUrl += `&continuation-token=${encodeURIComponent(continuationToken)}`;
            }

            const listRequest = new Request(listUrl, { method: 'GET' });
            const signedList = await client.sign(listRequest, {
              aws: { service: 's3', region: 'auto' }
            });

            const listResponse = await fetch(signedList);

            if (!listResponse.ok) {
              throw new Error(`Failed to list objects: ${listResponse.status}`);
            }

            const listXml = await listResponse.text();

            // Parse sizes from XML
            const sizeMatches = listXml.matchAll(/<Size>([^<]+)<\/Size>/g);
            for (const match of sizeMatches) {
              totalBytes += parseInt(match[1]) || 0;
              fileCount++;
            }

            // Check for continuation token
            const tokenMatch = listXml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
            continuationToken = tokenMatch ? tokenMatch[1] : null;

          } while (continuationToken);

          console.log('Storage stats:', { totalBytes, fileCount });

          return new Response(JSON.stringify({
            success: true,
            totalBytes,
            fileCount,
            totalMB: Math.round(totalBytes / 1024 / 1024 * 100) / 100,
            totalGB: Math.round(totalBytes / 1024 / 1024 / 1024 * 100) / 100
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (statsError) {
          console.error('Storage stats error:', statsError);
          return new Response(JSON.stringify({
            error: "Failed to get storage stats",
            details: statsError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // --- 7. TRIGGER POINT CLOUD PROCESSING (GCP Cloud Run Jobs) ---
      if (url.pathname === '/process-pointcloud' && request.method === 'POST') {
        console.log('=== PROCESS-POINTCLOUD ENDPOINT HIT ===');

        try {
          const requestBody = await request.json();
          const { assetId, rawFileUrl, projectId } = requestBody;

          if (!assetId || !rawFileUrl) {
            return new Response(JSON.stringify({
              error: "Missing required fields: assetId, rawFileUrl"
            }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          // Check if GCP credentials are configured
          if (!env.GCP_PROJECT_ID || !env.GCP_REGION || !env.GCP_SERVICE_ACCOUNT_KEY) {
            console.warn('GCP configuration missing - returning mock response for development');
            return new Response(JSON.stringify({
              success: true,
              message: "Point cloud processing triggered (mock - GCP not configured)",
              assetId,
              mock: true
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          // Parse GCP service account key
          const serviceAccount = JSON.parse(env.GCP_SERVICE_ACCOUNT_KEY);

          // Get GCP access token using service account
          const tokenResponse = await getGCPAccessToken(serviceAccount);

          if (!tokenResponse.access_token) {
            throw new Error('Failed to obtain GCP access token');
          }

          // Construct public R2 URL for output
          const outputBucket = env.PUBLIC_DOMAIN || `https://pub-${env.ACCOUNT_ID}.r2.dev`;

          console.log('Triggering Cloud Run Job with args:', [
            '--asset-id', assetId,
            '--input-url', rawFileUrl,
            '--output-bucket', outputBucket
          ]);

          // Trigger Cloud Run Job
          const jobUrl = `https://${env.GCP_REGION}-run.googleapis.com/v2/projects/${env.GCP_PROJECT_ID}/locations/${env.GCP_REGION}/jobs/pointcloud-converter:run`;

          const jobResponse = await fetch(jobUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenResponse.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              overrides: {
                containerOverrides: [{
                  args: [
                    '--asset-id', assetId,
                    '--input-url', rawFileUrl,
                    '--output-bucket', outputBucket
                  ]
                }]
              }
            })
          });

          if (!jobResponse.ok) {
            const errorText = await jobResponse.text();
            console.error('GCP Job trigger failed:', errorText);
            throw new Error(`GCP Job trigger failed: ${jobResponse.status}`);
          }

          const jobResult = await jobResponse.json();
          console.log('GCP Job triggered successfully:', jobResult.name);

          return new Response(JSON.stringify({
            success: true,
            message: "Point cloud processing started",
            assetId,
            executionId: jobResult.name
          }), {
            status: 202,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });

        } catch (processError) {
          console.error('Process pointcloud error:', processError);
          return new Response(JSON.stringify({
            error: "Failed to trigger point cloud processing",
            details: processError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // If we get here, no endpoint matched
      console.log('=== NO ENDPOINT MATCHED ===');
      console.log('Pathname:', url.pathname);
      console.log('Method:', request.method);
      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (e) {
      console.error('Worker error:', e);
      console.error('Error stack:', e.stack);
      return new Response(JSON.stringify({
        error: e.message || "Internal server error",
        stack: e.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  },
};
