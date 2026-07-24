let currentNode = null;

// Check session on load
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    loadNodes();
});

async function checkSession() {
    const response = await fetch('/api/session');
    const data = await response.json();
    
    if (data.logged_in) {
        document.getElementById('logged-in-status').style.display = 'inline';
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-handle').textContent = data.handle;
    } else {
        document.getElementById('logged-in-status').style.display = 'none';
        document.getElementById('login-btn').style.display = 'inline';
    }
}

async function login(event) {
    event.preventDefault();
    
    const handle = document.getElementById('handle').value;
    const password = document.getElementById('password').value;
    
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({handle, password})
    });
    
    const data = await response.json();
    
    if (data.success) {
        closeModal();
        checkSession();
        document.getElementById('handle').value = '';
        document.getElementById('password').value = '';
    } else {
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = data.error || 'Login failed';
        errorEl.classList.add('active');
    }
}

async function logout() {
    await fetch('/api/logout', {method: 'POST'});
    checkSession();
    loadNodes();
}

async function loadNodes() {
    const response = await fetch('/api/nodes');
    const nodes = await response.json();
    
    const grid = document.getElementById('nodes-grid');
    grid.innerHTML = '';
    
    nodes.forEach(node => {
        const card = document.createElement('div');
        card.className = 'node-card' + (node.pushed ? ' pushed' : '');
        
        const tags = node.tags ? node.tags.map(t => `<span class="badge">${t}</span>`).join('') : '';
        const status = node.pushed ? '<span class="badge pushed">✓ Pushed</span>' : '';
        
        // Add gear icon for manageable nodes
        const gearIcon = node.manageable ? `<button class="gear-btn" onclick="event.stopPropagation(); showNSFWManager()" title="Manage Terms">⚙</button>` : '';
        
        card.innerHTML = `
            ${gearIcon}
            <div onclick="showNodeDetail('${node.id}')">
                <h3>${node.name}</h3>
                <p>${node.description}</p>
                <div class="node-meta">
                    <span class="badge">v${node.version}</span>
                    ${tags}
                    ${status}
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

async function showNodeDetail(nodeId) {
    const response = await fetch(`/api/nodes/${nodeId}`);
    const node = await response.json();
    
    currentNode = node;
    
    document.getElementById('node-title').textContent = node.name;
    document.getElementById('node-description').textContent = node.description;
    document.getElementById('node-version').textContent = `v${node.version}`;
    document.getElementById('node-author').textContent = node.author;
    
    let status = '';
    if (node.pushed && node.component_id) {
        const url = `https://www.graze.social/app/custom-nodes/${node.component_id}/view`;
        status = `<span class="badge pushed">✓ Pushed to Graze</span> <a href="${url}" target="_blank" style="color: #6366f1; text-decoration: none;">View #${node.component_id} →</a>`;
    } else {
        status = '<span class="badge">Not pushed yet</span>';
    }
    document.getElementById('node-status').innerHTML = status;
    
    // Set form defaults - use custom values if saved, otherwise use node defaults
    const titleInput = document.getElementById('node-form-title');
    const descInput = document.getElementById('node-form-description');
    
    titleInput.value = node.custom_title || node.name;
    descInput.value = node.custom_description || node.description;
    
    // Store defaults for reset
    titleInput.dataset.default = node.name;
    descInput.dataset.default = node.description;
    
    // Show/hide reset buttons based on whether custom values exist
    updateResetButtons();
    
    // Render configurable options if any
    renderConfigOptions(node);
    
    // Show manifest preview
    document.getElementById('manifest-preview').textContent = JSON.stringify(node.manifest, null, 2);
    
    // Update button text
    document.getElementById('push-btn').textContent = node.pushed ? 'Update on Graze' : 'Push to Graze';
    
    document.getElementById('node-modal').classList.add('active');
}

async function pushNode() {
    if (!currentNode) return;
    
    const title = document.getElementById('node-form-title').value;
    const description = document.getElementById('node-form-description').value;
    
    // Check for component ID override
    const overrideCheckbox = document.getElementById('override-component-id');
    const componentIdInput = document.getElementById('component-id-input');
    const overrideComponentId = overrideCheckbox.checked ? componentIdInput.value : null;
    
    // Collect config values
    const config = {};
    const configInputs = document.querySelectorAll('[data-config-key]');
    configInputs.forEach(input => {
        const key = input.dataset.configKey;
        if (input.type === 'number') {
            config[key] = input.value ? parseInt(input.value) : null;
        } else {
            config[key] = input.value;
        }
    });
    
    const resultEl = document.getElementById('push-result');
    resultEl.textContent = 'Pushing...';
    resultEl.className = 'result active';
    
    try {
        const payload = {title, description, config};
        if (overrideComponentId) {
            payload.override_component_id = overrideComponentId;
        }
        
        const response = await fetch(`/api/nodes/${currentNode.id}/push`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success) {
            resultEl.textContent = `✓ Successfully ${data.action}! View at: ${data.url}`;
            resultEl.className = 'result active success';
            
            setTimeout(() => {
                loadNodes();
            }, 2000);
        } else {
            resultEl.textContent = `Error: ${data.error}`;
            resultEl.className = 'result active error';
        }
    } catch (error) {
        resultEl.textContent = `Error: ${error.message}`;
        resultEl.className = 'result active error';
    }
}

function showLoginModal() {
    document.getElementById('login-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('login-error').classList.remove('active');
}

function closeNodeModal() {
    document.getElementById('node-modal').classList.remove('active');
    document.getElementById('push-result').classList.remove('active');
    currentNode = null;
}

function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    if (tabName === 'graze') {
        loadGrazeDocs();
    } else if (tabName === 'metadata') {
        loadMetadataDocs();
    } else if (tabName === 'reference') {
        loadReferenceDocs();
    }
}

async function loadGrazeDocs() {
    const content = document.getElementById('graze-content');
    content.innerHTML = `
        <div class="doc-category">
            <h3>Logical Operators</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>and</code> <span style="color: #888; font-weight: normal;">(All of these)</span></div>
                    <p>All conditions must be true</p>
                    <pre>{"and": [{...}, {...}], "metadata": {}}</pre>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>or</code> <span style="color: #888; font-weight: normal;">(Any of these)</span></div>
                    <p>At least one condition must be true</p>
                    <pre>{"or": [{...}, {...}], "metadata": {}}</pre>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Text Matching</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>regex_matches</code> <span style="color: #888; font-weight: normal;">(Regex - Contains)</span></div>
                    <p>Match single regex pattern (manual regex control)</p>
                    <pre>{"regex_matches": ["text", "\\\\bword\\\\b", true]}</pre>
                    <div class="doc-meta">Parameters: field, pattern, case_insensitive</div>
                    <div class="doc-meta" style="margin-top: 0.5rem;">case_insensitive: true (default) | false (case sensitive)</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>regex_negation_matches</code> <span style="color: #888; font-weight: normal;">(Regex - Missing)</span></div>
                    <p>Negation match - excludes matching patterns</p>
                    <pre>{"regex_negation_matches": ["text", "\\\\bword\\\\b", true]}</pre>
                    <div class="doc-meta">Parameters: field, pattern, case_insensitive</div>
                    <div class="doc-meta" style="margin-top: 0.5rem;">case_insensitive: true (default) | false (case sensitive)</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>regex_any</code> <span style="color: #888; font-weight: normal;">(Word List - Contains)</span></div>
                    <p>Match any pattern from list</p>
                    <pre>{"regex_any": ["text", ["cat", "dog"], true, false]}</pre>
                    <div class="doc-meta">Parameters: field, patterns, case_insensitive, multiline</div>
                    <div class="doc-meta" style="margin-top: 0.5rem;">case_insensitive: true (default) | false (case sensitive)</div>
                    <div class="doc-meta">multiline: false (word list, auto \b) | true (regex mode)</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>regex_none</code> <span style="color: #888; font-weight: normal;">(Word List - Missing)</span></div>
                    <p>Match none of the patterns - excludes all</p>
                    <pre>{"regex_none": ["text", ["spam"], true, false]}</pre>
                    <div class="doc-meta">Parameters: field, patterns, case_insensitive, multiline</div>
                    <div class="doc-meta" style="margin-top: 0.5rem;">case_insensitive: true (default) | false (case sensitive)</div>
                    <div class="doc-meta">multiline: false (word list, auto \b) | true (regex mode)</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Content Type</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed_type</code></div>
                    <p>Filter by embed type</p>
                    <pre>{"embed_type": ["==", "video"]}</pre>
                    <div class="doc-meta">Types: video, image, image_group, link, post, gif</div>
                    <div class="doc-meta" style="color: #3b82f6; margin-top: 0.5rem;">ℹ️ Note: "video" type has special behavior - it enables video feed UI mode. This cannot be toggled conditionally in custom nodes.</div>
                    <div class="doc-meta" style="color: #ef4444; margin-top: 0.5rem;">⚠️ Note: The "gif" type may be unreliable. Use attribute_compare with embed.presentation instead:</div>
                    <pre style="margin-top: 0.5rem;">{"attribute_compare": ["embed.presentation", "==", "gif"]}</pre>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>post_type</code></div>
                    <p>Filter by post type</p>
                    <pre>{"post_type": ["not_in", ["reply"]]}</pre>
                    <div class="doc-meta">Types: reply, quote</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>entity_matches</code></div>
                    <p>Match hashtags, langs, domains, mentions</p>
                    <pre>{"entity_matches": ["langs", ["en", "es"]]}</pre>
                    <div class="doc-meta">Entities: langs, urls, domains, mentions, hashtags</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Social Graph</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>social_graph</code></div>
                    <p>Check follower/following relationships</p>
                    <pre>{"social_graph": ["user.bsky.social", "in", "followers"]}</pre>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>list_member</code></div>
                    <p>Check list membership</p>
                    <pre>{"list_member": ["https://bsky.app/profile/.../lists/...", "in"]}</pre>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>starter_pack_member</code></div>
                    <p>Check starter pack membership</p>
                    <pre>{"starter_pack_member": ["https://bsky.app/starter-pack/...", "in"]}</pre>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>social_list</code></div>
                    <p>Explicit DID list</p>
                    <pre>{"social_list": [["did:plc:abc", "did:plc:def"], "in"]}</pre>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Comparison</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>attribute_compare</code></div>
                    <p>Compare post attributes to values</p>
                    <pre>{"attribute_compare": ["embed.video.size", ">=", "$MIN_SIZE"]}</pre>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>param_compare</code></div>
                    <p>Compare parameter values</p>
                    <pre>{"param_compare": ["$ENABLED", "==", true]}</pre>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>ML Models</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>sentiment_analysis</code></div>
                    <p>Sentiment classification</p>
                    <pre>{"sentiment_analysis": ["Positive", ">=", 0.5]}</pre>
                    <div class="doc-meta">Categories: Positive, Negative, Neutral</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>emotion_sentiment_analysis</code></div>
                    <p>Emotion detection (GoEmotions)</p>
                    <pre>{"emotion_sentiment_analysis": ["Joy", ">=", 0.5]}</pre>
                    <div class="doc-meta">28 emotions: Joy, Anger, Fear, Sadness, etc.</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>toxicity_analysis</code></div>
                    <p>Toxicity detection</p>
                    <pre>{"toxicity_analysis": ["Toxic", "<=", 0.5]}</pre>
                    <div class="doc-meta">Categories: Toxic, Severe Toxicity, Obscene, Threat, Insult, Identity Hate</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>topic_analysis</code></div>
                    <p>Topic classification</p>
                    <pre>{"topic_analysis": ["Gaming", ">=", 0.5]}</pre>
                    <div class="doc-meta">20+ topics: Gaming, Sports, Tech, News, etc.</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>language_analysis</code></div>
                    <p>Advanced language detection</p>
                    <pre>{"language_analysis": ["Spanish", ">=", 0.5]}</pre>
                    <div class="doc-meta">20+ languages supported</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>text_similarity</code></div>
                    <p>Semantic similarity using transformers</p>
                    <pre>{"text_similarity": ["text", {"anchor_text": "...", "model_name": "all-MiniLM-L6-v2"}, ">=", 0.3]}</pre>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>text_arbitrary</code></div>
                    <p>Custom text label classification</p>
                    <pre>{"text_arbitrary": ["scotland", ">=", 0.5]}</pre>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>image_nsfw</code></div>
                    <p>NSFW image detection</p>
                    <pre>{"image_nsfw": ["NSFW", "<=", 0.5]}</pre>
                    <div class="doc-meta">Categories: NSFW, SFW</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>image_arbitrary</code></div>
                    <p>Custom image label classification (CLIP)</p>
                    <pre>{"image_arbitrary": ["scotland", ">=", 0.5, 0.0]}</pre>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Special Operations</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>each</code></div>
                    <p>Loop over list parameters (not a logic node)</p>
                    <pre>{"each": ["$LIST", {...}]}</pre>
                    <div class="doc-meta">Use $PARAM_NAME_ITEM to reference current item</div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('graze-search').oninput = (e) => filterCards(e.target.value, 'graze-content');
}

async function loadMetadataDocs() {
    const content = document.getElementById('metadata-content');
    content.innerHTML = `
        <div class="doc-category">
            <h3>Core Fields</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>text</code> <span style="color: #888; font-weight: normal;">(Text)</span></div>
                    <p>Post text content</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>createdAt</code></div>
                    <p>ISO 8601 timestamp</p>
                    <div class="doc-meta">Example: "2026-02-11T00:25:50.501Z"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>langs</code></div>
                    <p>Array of language codes (ISO 639-1)</p>
                    <div class="doc-meta">Example: ["en", "es"]</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>langs[*]</code> <span style="color: #888; font-weight: normal;">(Language)</span></div>
                    <p>Individual language code (for filtering)</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>$type</code></div>
                    <p>Record type</p>
                    <div class="doc-meta">Value: "app.bsky.feed.post"</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Labels</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>labels.$type</code></div>
                    <p>Label definition type</p>
                    <div class="doc-meta">Value: "com.atproto.label.defs#selfLabels"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>labels.values</code></div>
                    <p>Array of label objects</p>
                    <div class="doc-meta">Type: array</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>labels.values[*].val</code> <span style="color: #888; font-weight: normal;">(Self Labels)</span></div>
                    <p>Self-applied content labels</p>
                    <div class="doc-meta">Examples: "porn", "graphic-media"</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Facets (Rich Text)</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>facets</code></div>
                    <p>Array of rich text facet objects</p>
                    <div class="doc-meta">Type: array</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>facets[*].$type</code></div>
                    <p>Facet type definition</p>
                    <div class="doc-meta">Value: "app.bsky.richtext.facet"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>facets[*].index.byteStart</code></div>
                    <p>Start position in text (byte offset)</p>
                    <div class="doc-meta">Type: number</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>facets[*].index.byteEnd</code></div>
                    <p>End position in text (byte offset)</p>
                    <div class="doc-meta">Type: number</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>facets[*].features</code></div>
                    <p>Array of feature objects (links, mentions, tags)</p>
                    <div class="doc-meta">Type: array</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>facets[*].features[*].$type</code></div>
                    <p>Feature type</p>
                    <div class="doc-meta">Values: #link, #mention, #tag</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>facets[*].features[*].uri</code> <span style="color: #888; font-weight: normal;">(Facets Features URI)</span></div>
                    <p>Link URLs in post text</p>
                    <div class="doc-meta">Type: string (URL)</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>facets[*].features[*].did</code></div>
                    <p>Mentioned user DIDs</p>
                    <div class="doc-meta">Type: string (DID)</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>facets[*].features[*].tag</code></div>
                    <p>Hashtag text (without #)</p>
                    <div class="doc-meta">Type: string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Reply Structure</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>reply.root.uri</code></div>
                    <p>AT URI of root post in thread</p>
                    <div class="doc-meta">Type: AT URI string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>reply.root.cid</code></div>
                    <p>Content ID of root post</p>
                    <div class="doc-meta">Type: CID string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>reply.parent.uri</code></div>
                    <p>AT URI of immediate parent post</p>
                    <div class="doc-meta">Type: AT URI string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>reply.parent.cid</code></div>
                    <p>Content ID of parent post</p>
                    <div class="doc-meta">Type: CID string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Embeds - Images</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.$type</code></div>
                    <p>Images embed type</p>
                    <div class="doc-meta">Value: "app.bsky.embed.images"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.images</code></div>
                    <p>Array of image objects (1-4 images)</p>
                    <div class="doc-meta">Type: array</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.alt</code> <span style="color: #888; font-weight: normal;">(Video Alt Text)</span></div>
                    <p>Video alt text</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.images[*].alt</code> <span style="color: #888; font-weight: normal;">(Alt Text)</span></div>
                    <p>Image alt text (can be empty string)</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.images[*].image</code></div>
                    <p>Image blob object</p>
                    <div class="doc-meta">Type: blob</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.images[*].image.mimeType</code></div>
                    <p>Image MIME type</p>
                    <div class="doc-meta">Examples: "image/jpeg", "image/png"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.images[*].image.size</code></div>
                    <p>Image file size in bytes</p>
                    <div class="doc-meta">Type: number</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.images[*].aspectRatio</code></div>
                    <p>Aspect ratio object</p>
                    <div class="doc-meta">Type: object</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.images[*].aspectRatio.width</code></div>
                    <p>Image width</p>
                    <div class="doc-meta">Type: number</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.images[*].aspectRatio.height</code></div>
                    <p>Image height</p>
                    <div class="doc-meta">Type: number</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.media.images[*].alt</code> <span style="color: #888; font-weight: normal;">(Media Alt Text)</span></div>
                    <p>Image alt text in quote post with media</p>
                    <div class="doc-meta">Type: string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Embeds - Video</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.$type</code></div>
                    <p>Video embed type</p>
                    <div class="doc-meta">Value: "app.bsky.embed.video"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.video</code></div>
                    <p>Video blob object</p>
                    <div class="doc-meta">Type: blob</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.video.mimeType</code></div>
                    <p>Video MIME type</p>
                    <div class="doc-meta">Value: "video/mp4"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.video.size</code></div>
                    <p>Video file size in bytes</p>
                    <div class="doc-meta">Type: number</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.aspectRatio</code></div>
                    <p>Aspect ratio object (not array!)</p>
                    <div class="doc-meta">Type: object</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.aspectRatio.width</code></div>
                    <p>Video width</p>
                    <div class="doc-meta">Type: number</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.aspectRatio.height</code></div>
                    <p>Video height</p>
                    <div class="doc-meta">Type: number</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.presentation</code></div>
                    <p>Video presentation type (optional)</p>
                    <div class="doc-meta">Value: "gif" for GIFs</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Embeds - External Links</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.$type</code></div>
                    <p>External link embed type</p>
                    <div class="doc-meta">Value: "app.bsky.embed.external"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.external.uri</code> <span style="color: #888; font-weight: normal;">(Link Card URL)</span></div>
                    <p>External link URL</p>
                    <div class="doc-meta">Type: string (URL)</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.external.title</code> <span style="color: #888; font-weight: normal;">(Link Card Title)</span></div>
                    <p>Link preview title</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.external.description</code> <span style="color: #888; font-weight: normal;">(Link Card Description)</span></div>
                    <p>Link preview description</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.external.thumb</code></div>
                    <p>Thumbnail blob (optional)</p>
                    <div class="doc-meta">Type: blob object</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.external.thumb.mimeType</code></div>
                    <p>Thumbnail MIME type</p>
                    <div class="doc-meta">Example: "image/jpeg"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.external.thumb.size</code></div>
                    <p>Thumbnail size in bytes</p>
                    <div class="doc-meta">Type: number</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.media.external.uri</code> <span style="color: #888; font-weight: normal;">(Link Media URL)</span></div>
                    <p>External link URL in quote post with media</p>
                    <div class="doc-meta">Type: string (URL)</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.media.external.title</code> <span style="color: #888; font-weight: normal;">(Link Media Title)</span></div>
                    <p>Link preview title in quote post with media</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.media.external.description</code> <span style="color: #888; font-weight: normal;">(Link Media Description)</span></div>
                    <p>Link preview description in quote post with media</p>
                    <div class="doc-meta">Type: string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Embeds - Quoted Posts</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.$type</code></div>
                    <p>Quote post embed type</p>
                    <div class="doc-meta">Value: "app.bsky.embed.record"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.record.uri</code> <span style="color: #888; font-weight: normal;">(Internal Bluesky URL)</span></div>
                    <p>AT URI of quoted post</p>
                    <div class="doc-meta">Format: at://did/collection/rkey</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.record.cid</code></div>
                    <p>Content ID of quoted post</p>
                    <div class="doc-meta">Type: CID string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Embeds - Quote Post with Media</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.$type</code></div>
                    <p>Quote post with media embed type</p>
                    <div class="doc-meta">Value: "app.bsky.embed.recordWithMedia"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.media</code></div>
                    <p>Media embed object (images, video, or external)</p>
                    <div class="doc-meta">Type: embed object</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.media.$type</code></div>
                    <p>Media type</p>
                    <div class="doc-meta">Values: images, video, external</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.record</code></div>
                    <p>Quote post record object</p>
                    <div class="doc-meta">Type: record object</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.record.record.uri</code></div>
                    <p>AT URI of quoted post</p>
                    <div class="doc-meta">Type: AT URI string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>embed.record.record.cid</code></div>
                    <p>Content ID of quoted post</p>
                    <div class="doc-meta">Type: CID string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Hydrated Metadata - User</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.user.did</code> <span style="color: #888; font-weight: normal;">(User DID)</span></div>
                    <p>Post author DID</p>
                    <div class="doc-meta">Type: string (DID)</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.user.handle</code> <span style="color: #888; font-weight: normal;">(User Handle)</span></div>
                    <p>Post author handle</p>
                    <div class="doc-meta">Example: "user.bsky.social"</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.user.display_name</code> <span style="color: #888; font-weight: normal;">(User Display Name)</span></div>
                    <p>Post author display name</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.user.description</code> <span style="color: #888; font-weight: normal;">(User Bio)</span></div>
                    <p>Post author bio</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.user.labels[*].val</code> <span style="color: #888; font-weight: normal;">(User Labels)</span></div>
                    <p>User labels</p>
                    <div class="doc-meta">Type: string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Hydrated Metadata - Mentions</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.mentions[*].handle</code> <span style="color: #888; font-weight: normal;">(Mentioned User Handles)</span></div>
                    <p>Mentioned user handles</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.mentions[*].display_name</code> <span style="color: #888; font-weight: normal;">(Mentioned User Names)</span></div>
                    <p>Mentioned user display names</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.mentions[*].description</code> <span style="color: #888; font-weight: normal;">(Mentioned User Bios)</span></div>
                    <p>Mentioned user bio</p>
                    <div class="doc-meta">Type: string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Hydrated Metadata - Quote Post</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.quote_post.author.handle</code> <span style="color: #888; font-weight: normal;">(Quoted Author Handle)</span></div>
                    <p>Quoted post author handle</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.quote_post.author.display_name</code> <span style="color: #888; font-weight: normal;">(Quoted Author Name)</span></div>
                    <p>Quoted post author display name</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.quote_post.record.text</code> <span style="color: #888; font-weight: normal;">(Quoted Post Text)</span></div>
                    <p>Quoted post text</p>
                    <div class="doc-meta">Type: string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Hydrated Metadata - Parent Post</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.parent_post.author.handle</code> <span style="color: #888; font-weight: normal;">(Parent Author Handle)</span></div>
                    <p>Parent post author handle</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.parent_post.author.display_name</code> <span style="color: #888; font-weight: normal;">(Parent Author Name)</span></div>
                    <p>Parent post author display name</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.parent_post.record.text</code> <span style="color: #888; font-weight: normal;">(Parent Post Text)</span></div>
                    <p>Parent post text</p>
                    <div class="doc-meta">Type: string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Hydrated Metadata - Reply Post</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.reply_post.author.handle</code></div>
                    <p>Reply author handle</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>hydrated_metadata.reply_post.record.text</code> <span style="color: #888; font-weight: normal;">(Thread Root Text)</span></div>
                    <p>Reply text</p>
                    <div class="doc-meta">Type: string</div>
                </div>
            </div>
        </div>
        
        <div class="doc-category">
            <h3>Inferences</h3>
            <div class="doc-cards">
                <div class="doc-card">
                    <div class="doc-card-header"><code>inferences.video.audio_transcription.text</code> <span style="color: #888; font-weight: normal;">(Video Transcription Text)</span></div>
                    <p>Video audio transcription</p>
                    <div class="doc-meta">Type: string</div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header"><code>inferences.video.audio_transcription.language</code> <span style="color: #888; font-weight: normal;">(Video Transcription Language)</span></div>
                    <p>Transcription language</p>
                    <div class="doc-meta">Type: string</div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('metadata-search').oninput = (e) => filterCards(e.target.value, 'metadata-content');
}

async function loadReferenceDocs() {
    const response = await fetch('/api/docs/reference');
    const data = await response.json();
    document.getElementById('reference-content').innerHTML = '<pre style="white-space: pre-wrap;">' + data.content + '</pre>';
    
    document.getElementById('reference-search').oninput = (e) => searchContent(e.target.value, 'reference-content', 'reference');
}

function filterCards(searchTerm, contentId) {
    const content = document.getElementById(contentId);
    const cards = content.querySelectorAll('.doc-card');
    const categories = content.querySelectorAll('.doc-category');
    
    if (!searchTerm) {
        cards.forEach(card => card.style.display = 'block');
        categories.forEach(cat => cat.style.display = 'block');
        return;
    }
    
    const term = searchTerm.toLowerCase();
    categories.forEach(category => {
        const categoryCards = category.querySelectorAll('.doc-card');
        let visibleCount = 0;
        
        categoryCards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(term)) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        category.style.display = visibleCount > 0 ? 'block' : 'none';
    });
}

function searchContent(searchTerm, contentId, docType) {
    const content = document.getElementById(contentId);
    const pre = content.querySelector('pre');
    if (!pre) return;
    
    const lines = pre.textContent.split('\n');
    const filtered = lines.filter(line => line.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (searchTerm) {
        pre.innerHTML = filtered.map(line => {
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            return line.replace(regex, '<mark>$1</mark>');
        }).join('\n');
    } else {
        loadReferenceDocs();
    }
}

function toggleComponentIdOverride() {
    const checkbox = document.getElementById('override-component-id');
    const overrideDiv = document.getElementById('component-id-override');
    overrideDiv.style.display = checkbox.checked ? 'block' : 'none';
}

function updateResetButtons() {
    const titleInput = document.getElementById('node-form-title');
    const descInput = document.getElementById('node-form-description');
    const titleReset = document.getElementById('title-reset');
    const descReset = document.getElementById('desc-reset');
    
    if (titleInput && titleReset) {
        titleReset.style.display = titleInput.value !== titleInput.dataset.default ? 'inline' : 'none';
    }
    if (descInput && descReset) {
        descReset.style.display = descInput.value !== descInput.dataset.default ? 'inline' : 'none';
    }
}

function resetTitle() {
    const titleInput = document.getElementById('node-form-title');
    titleInput.value = titleInput.dataset.default;
    updateResetButtons();
}

function resetDescription() {
    const descInput = document.getElementById('node-form-description');
    descInput.value = descInput.dataset.default;
    updateResetButtons();
}

function renderConfigOptions(node) {
    const optionsDiv = document.getElementById('node-options');
    
    if (!node.configurable || Object.keys(node.configurable).length === 0) {
        optionsDiv.innerHTML = '';
        return;
    }
    
    let html = '<div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e5e5e5;"><h4>Node Configuration</h4>';
    
    for (const [key, config] of Object.entries(node.configurable)) {
        const savedValue = node.saved_config && node.saved_config[key];
        const defaultValue = config.default || '';
        const value = savedValue !== undefined ? savedValue : defaultValue;
        
        html += `<div style="margin-bottom: 1rem;">`;
        html += `<label>${config.description || key}:</label>`;
        
        if (config.type === 'number') {
            const min = config.min !== undefined ? `min="${config.min}"` : '';
            const max = config.max !== undefined ? `max="${config.max}"` : '';
            html += `<input type="number" data-config-key="${key}" value="${value}" ${min} ${max} style="width: 100%; padding: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px;">`;
        } else {
            html += `<input type="text" data-config-key="${key}" value="${value}" style="width: 100%; padding: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px;">`;
        }
        
        html += `</div>`;
    }
    
    html += '</div>';
    optionsDiv.innerHTML = html;
}

// Close modals on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// NSFW Manager
let currentCategory = null;
let currentCategoryData = null;

async function showNSFWManager() {
    const response = await fetch('/api/nsfw/categories');
    const categories = await response.json();
    
    const list = document.getElementById('nsfw-categories-list');
    list.innerHTML = `
        <input type="text" id="nsfw-global-search" placeholder="Search for a term across all categories..." style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px;">
        <div id="nsfw-global-results" style="display: none; padding: 0.5rem; margin-bottom: 0.5rem; background: #f0f9ff; border: 1px solid #3b82f6; border-radius: 4px;"></div>
        <input type="text" id="nsfw-category-search" placeholder="Filter categories..." style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px;">` + 
        categories.map(cat => 
        `<div class="nsfw-category-item" data-name="${cat.name.toLowerCase()}" data-desc="${cat.description.toLowerCase()}" onclick="loadNSFWCategory('${cat.id}', '${cat.name}', '${cat.description}')">
            <strong>${cat.name}</strong>
            <div style="color: #888; font-size: 0.85em;">${cat.description}</div>
            <span style="color: #888; font-size: 0.9em;" id="count-${cat.id}">Loading...</span>
        </div>`
    ).join('');
    
    // Global search
    document.getElementById('nsfw-global-search').oninput = async (e) => {
        const term = e.target.value.trim();
        const resultsDiv = document.getElementById('nsfw-global-results');
        if (!term) {
            resultsDiv.style.display = 'none';
            return;
        }
        const resp = await fetch(`/api/nsfw/search/${encodeURIComponent(term)}`);
        const results = await resp.json();
        if (results.length > 0) {
            resultsDiv.innerHTML = `<strong>"${term}" found in:</strong> ${results.map(r => r.category).join(', ')}`;
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.innerHTML = `<strong>"${term}" not found in any category</strong>`;
            resultsDiv.style.display = 'block';
        }
    };
    
    // Category filter
    document.getElementById('nsfw-category-search').oninput = (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.nsfw-category-item').forEach(item => {
            const matchName = item.dataset.name.includes(term);
            const matchDesc = item.dataset.desc.includes(term);
            item.style.display = (matchName || matchDesc) ? 'block' : 'none';
        });
    };
    
    // Load counts for all categories
    categories.forEach(async cat => {
        const resp = await fetch(`/api/nsfw/${cat.id}`);
        const data = await resp.json();
        const termCount = (data.terms || []).length;
        const hashtagCount = (data.hashtags || []).length;
        const domainCount = (data.domains || []).length;
        const total = termCount + hashtagCount + domainCount;
        document.getElementById(`count-${cat.id}`).textContent = `${total} items`;
    });
    
    document.getElementById('nsfw-manager-modal').classList.add('active');
}

function closeNSFWManager() {
    document.getElementById('nsfw-manager-modal').classList.remove('active');
    currentCategory = null;
    currentCategoryData = null;
}

async function loadNSFWCategory(categoryId, categoryName, categoryDescription) {
    currentCategory = categoryId;
    const response = await fetch(`/api/nsfw/${categoryId}`);
    currentCategoryData = await response.json();
    
    // Show counts and description
    const termCount = (currentCategoryData.terms || []).length;
    const hashtagCount = (currentCategoryData.hashtags || []).length;
    const domainCount = (currentCategoryData.domains || []).length;
    document.getElementById('nsfw-category-name').innerHTML = `
        ${categoryName} (${termCount} terms, ${hashtagCount} hashtags, ${domainCount} domains)<br>
        <small style="color: #888; font-weight: normal;">${categoryDescription}</small>
    `;
    
    // Render terms
    const termsDiv = document.getElementById('nsfw-terms-list');
    const terms = currentCategoryData.terms || [];
    termsDiv.innerHTML = terms.length > 0 ? terms.map((term, i) => 
        `<div class="nsfw-term-item" data-term="${term.toLowerCase()}">
            <span>${term}</span>
            <button onclick="removeNSFWTerm('terms', ${i})" class="remove-btn">&times;</button>
        </div>`
    ).join('') : '<p style="color: #888;">No terms</p>';
    
    // Render hashtags
    const hashtagsDiv = document.getElementById('nsfw-hashtags-list');
    const hashtags = currentCategoryData.hashtags || [];
    hashtagsDiv.innerHTML = hashtags.length > 0 ? hashtags.map((tag, i) => 
        `<div class="nsfw-term-item" data-term="${tag.toLowerCase()}">
            <span>#${tag}</span>
            <button onclick="removeNSFWTerm('hashtags', ${i})" class="remove-btn">&times;</button>
        </div>`
    ).join('') : '<p style="color: #888;">No hashtags</p>';
    
    // Render domains
    const domainsDiv = document.getElementById('nsfw-domains-list');
    const domains = currentCategoryData.domains || [];
    domainsDiv.innerHTML = domains.length > 0 ? domains.map((domain, i) => 
        `<div class="nsfw-term-item" data-term="${domain.toLowerCase()}">
            <span>${domain}</span>
            <button onclick="removeNSFWTerm('domains', ${i})" class="remove-btn">&times;</button>
        </div>`
    ).join('') : '<p style="color: #888;">No domains</p>';
    
    document.getElementById('nsfw-editor').style.display = 'block';
    
    // Set active tab to terms by default
    showNSFWTab('terms');
    
    // Add search functionality for current tab
    updateNSFWSearch();
}

function updateNSFWSearch() {
    const searchInputs = ['nsfw-terms-search', 'nsfw-hashtags-search', 'nsfw-domains-search'];
    searchInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.oninput = (e) => {
                const term = e.target.value.toLowerCase();
                const container = input.closest('.nsfw-tab-content');
                container.querySelectorAll('.nsfw-term-item').forEach(item => {
                    item.style.display = item.dataset.term.includes(term) ? 'flex' : 'none';
                });
            };
        }
    });
}

function removeNSFWTerm(type, index) {
    if (!currentCategoryData[type]) return;
    currentCategoryData[type].splice(index, 1);
    loadNSFWCategory(currentCategory, document.getElementById('nsfw-category-name').textContent);
}

async function addNSFWTerm(type) {
    const input = document.getElementById(`nsfw-${type}-input`);
    const value = input.value.trim();
    if (!value) return;
    
    // Check for duplicates across all categories
    const response = await fetch('/api/nsfw/categories');
    const categories = await response.json();
    const duplicates = [];
    
    for (const cat of categories) {
        const resp = await fetch(`/api/nsfw/${cat.id}`);
        const data = await resp.json();
        if (data[type] && data[type].some(item => item.toLowerCase() === value.toLowerCase())) {
            duplicates.push(cat.name);
        }
    }
    
    if (duplicates.length > 0) {
        const msg = `Warning: "${value}" already exists in: ${duplicates.join(', ')}\n\nAdd anyway?`;
        if (!confirm(msg)) return;
    }
    
    if (!currentCategoryData[type]) {
        currentCategoryData[type] = [];
    }
    
    currentCategoryData[type].push(value);
    input.value = '';
    loadNSFWCategory(currentCategory, document.getElementById('nsfw-category-name').textContent);
}

async function saveNSFWCategory() {
    if (!currentCategory) return;
    
    const response = await fetch(`/api/nsfw/${currentCategory}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(currentCategoryData)
    });
    
    const data = await response.json();
    if (data.success) {
        alert('Saved successfully!');
    } else {
        alert('Error saving: ' + data.error);
    }
}

function showNSFWTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.nsfw-tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nsfw-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(`nsfw-${tabName}-tab`).style.display = 'block';
    document.querySelector(`[onclick="showNSFWTab('${tabName}')"]`).classList.add('active');
    
    // Update search functionality for new tab
    updateNSFWSearch();
}

function parseBulkInput(text) {
    // Try JSON array first
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed.map(item => String(item).trim()).filter(item => item);
        }
    } catch (e) {}
    
    // Try comma-separated
    if (text.includes(',')) {
        return text.split(',').map(item => item.trim()).filter(item => item);
    }
    
    // Default: newline-separated
    return text.split('\n').map(item => item.trim()).filter(item => item);
}

function showBulkAdd(type) {
    document.getElementById('bulk-add-type').textContent = type;
    document.getElementById('bulk-add-input').value = '';
    document.getElementById('bulk-add-input').dataset.type = type;
    document.getElementById('bulk-add-modal').classList.add('active');
}

function closeBulkAdd() {
    document.getElementById('bulk-add-modal').classList.remove('active');
}

function processBulkAdd() {
    const type = document.getElementById('bulk-add-input').dataset.type;
    const text = document.getElementById('bulk-add-input').value.trim();
    if (!text) return;
    
    const items = parseBulkInput(text);
    if (items.length === 0) {
        alert('No valid items found');
        return;
    }
    
    if (!currentCategoryData[type]) {
        currentCategoryData[type] = [];
    }
    
    let added = 0;
    items.forEach(item => {
        if (!currentCategoryData[type].some(existing => existing.toLowerCase() === item.toLowerCase())) {
            currentCategoryData[type].push(item);
            added++;
        }
    });
    
    alert(`Added ${added} new ${type}. ${items.length - added} duplicates skipped.`);
    closeBulkAdd();
    loadNSFWCategory(currentCategory, document.getElementById('nsfw-category-name').textContent.split('(')[0].trim(), '');
}
