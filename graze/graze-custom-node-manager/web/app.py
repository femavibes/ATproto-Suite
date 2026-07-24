#!/usr/bin/env python3
"""
Graze Custom Node Manager - Web Interface
"""
from flask import Flask, render_template, request, jsonify, session
import os
import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graze_client import GrazeClient
from node_loader import get_all_nodes, get_node_by_id
from node_db import get_node_id, get_node_data, save_node_id, get_all_pushed_nodes, clear_node
from ai_helper import save_api_key, get_api_key, generate_suggestions, save_denied_term

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')

# Load whitelists
ALLOWED_USERS = [u.strip() for u in os.environ.get('ALLOWED_USERS', '').split(',') if u.strip()]
ADMIN_USERS = [u.strip() for u in os.environ.get('ADMIN_USERS', '').split(',') if u.strip()]

def is_allowed_user(handle):
    return handle in ALLOWED_USERS

def is_admin_user(handle):
    return handle in ADMIN_USERS

@app.route('/')
def index():
    """Main page"""
    nodes = get_all_nodes()
    pushed_nodes = get_all_pushed_nodes()
    return render_template('index.html', nodes=nodes, pushed_nodes=pushed_nodes)

@app.route('/api/login', methods=['POST'])
def login():
    """Login to Graze"""
    data = request.json
    handle = data.get('handle')
    password = data.get('password')
    
    if not handle or not password:
        return jsonify({'success': False, 'error': 'Handle and password required'}), 400
    
    # Check whitelist
    if not is_allowed_user(handle):
        return jsonify({'success': False, 'error': 'Unauthorized: This account is not whitelisted'}), 403
    
    client = GrazeClient()
    result = client.login(handle, password)
    
    if result['success']:
        session['session_cookie'] = result['session_cookie']
        session['handle'] = handle
        session['is_admin'] = is_admin_user(handle)
        return jsonify({'success': True, 'handle': handle, 'is_admin': session['is_admin']})
    else:
        return jsonify(result), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    """Logout"""
    session.clear()
    return jsonify({'success': True})

@app.route('/api/nodes')
def list_nodes():
    """List all available nodes"""
    nodes = get_all_nodes()
    pushed_nodes = get_all_pushed_nodes()
    handle = session.get('handle', '')
    
    # Add pushed status to nodes
    for node in nodes:
        # For logged-out users, check fema.monster's pushed nodes
        if not handle:
            node_key = f"fema.monster_{node['id']}"
        else:
            node_key = f"{handle}_{node['id']}"
            
        if node_key in pushed_nodes:
            node['pushed'] = True
            node['component_id'] = pushed_nodes[node_key]['component_id']
            node['last_pushed'] = pushed_nodes[node_key].get('last_pushed')
            # Include custom color from database
            if pushed_nodes[node_key].get('color'):
                node['custom_color'] = pushed_nodes[node_key]['color']
        else:
            node['pushed'] = False
        
        # Remove module reference for JSON serialization
        if 'module' in node:
            del node['module']
    
    return jsonify(nodes)

@app.route('/api/nodes/<node_id>')
def get_node(node_id):
    """Get a specific node"""
    node = get_node_by_id(node_id)
    if not node:
        return jsonify({'error': 'Node not found'}), 404
    
    # Get manifest preview
    manifest = node['module'].get_manifest()
    
    # Check if pushed and get saved data
    handle = session.get('handle', '')
    
    # For logged-out users, check fema.monster's pushed nodes
    if not handle:
        node_key = f"fema.monster_{node_id}"
    else:
        node_key = f"{handle}_{node_id}"
    
    node_data = get_node_data(node_key)
    
    result = {
        'id': node['id'],
        'name': node['name'],
        'description': node['description'],
        'color': node['color'],
        'version': node['version'],
        'author': node['author'],
        'tags': node.get('tags', []),
        'configurable': node.get('configurable', {}),
        'manageable': node.get('manageable', False),
        'manifest': manifest,
        'pushed': node_data is not None,
        'component_id': node_data.get('component_id') if node_data else None,
        'custom_title': node_data.get('title') if node_data else None,
        'custom_description': node_data.get('description') if node_data else None,
        'custom_color': node_data.get('color') if node_data else None,
        'saved_config': node_data.get('config', {}) if node_data else {}
    }
    
    return jsonify(result)

@app.route('/api/nodes/<node_id>/push', methods=['POST'])
def push_node(node_id):
    """Push a node to Graze"""
    if 'session_cookie' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    # Check admin permission
    if not session.get('is_admin', False):
        return jsonify({'error': 'Unauthorized: Only admins can push nodes to Graze'}), 403
    
    node = get_node_by_id(node_id)
    if not node:
        return jsonify({'error': 'Node not found'}), 404
    
    data = request.json
    title = data.get('title', node['name'])
    description = data.get('description', node['description'])
    color = data.get('color', node['color'])
    override_component_id = data.get('override_component_id')
    config = data.get('config', {})
    include_footer = data.get('include_footer', True)
    
    # Inject title prefix based on color (but don't save it)
    title_with_prefix = title
    if color == 'yellow':
        title_with_prefix = f"Moderation: {title}"
    elif color == 'green':
        title_with_prefix = f"Feature: {title}"
    elif color == 'brown':
        title_with_prefix = f"Utility: {title}"
    elif color == 'lime':
        title_with_prefix = f"Moderation Starterpack: {title}"
    elif color == 'grass':
        title_with_prefix = f"Feature Starterpack: {title}"
    elif color == 'jade':
        title_with_prefix = f"Mini Feature: {title}"
    elif color == 'amber':
        title_with_prefix = f"Mini Mod: {title}"
    
    # Append promotional footer if enabled (but don't save it)
    description_with_footer = description
    handle = session['handle']
    if include_footer:
        config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'data', 'user_configs', f'{handle}_config.json'
        )
        try:
            with open(config_path, 'r') as f:
                user_config = json.load(f)
            footer = user_config.get('promotional_footer', '')
            footer_enabled = user_config.get('promotional_footer_enabled', True)
            if footer and footer_enabled:
                description_with_footer = f"{description}\n\n---\n\n{footer}"
        except FileNotFoundError:
            pass
    
    # Get manifest with config options
    manifest = node['module'].get_manifest(config if config else None)
    
    # Override color in manifest metadata if custom color is set
    if 'filter' in manifest and 'metadata' in manifest['filter']:
        manifest['filter']['metadata']['color'] = color
    
    # Check if already pushed (per-user)
    handle = session['handle']
    node_key = f"{handle}_{node_id}"
    component_id = override_component_id or get_node_id(node_key)
    
    client = GrazeClient(session['session_cookie'])
    
    try:
        if component_id:
            # Update existing - use title WITH prefix and description WITH footer
            result = client.update_custom_node(component_id, title_with_prefix, description_with_footer, manifest, color)
            action = 'updated'
        else:
            # Create new - use title WITH prefix and description WITH footer
            result = client.create_custom_node(title_with_prefix, description_with_footer, manifest, color)
            component_id = result.get('id')
            action = 'created'
        
        # Save to database with per-user key - save title and description WITHOUT prefix/footer
        save_node_id(node_key, str(component_id), title, description, config, color)
        
        return jsonify({
            'success': True,
            'action': action,
            'component_id': component_id,
            'url': f'https://www.graze.social/app/custom-nodes/{component_id}/view'
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error pushing node {node_id}: {str(e)}")
        print(f"Manifest: {json.dumps(manifest, indent=2)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/nodes/<node_id>/clear', methods=['POST'])
def clear_node_tracking(node_id):
    """Clear node tracking (for testing)"""
    clear_node(node_id)
    return jsonify({'success': True})

@app.route('/api/nodes/<node_id>/config', methods=['POST'])
def save_node_config(node_id):
    """Save node configuration"""
    if 'handle' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    node = get_node_by_id(node_id)
    if not node:
        return jsonify({'error': 'Node not found'}), 404
    
    config = request.json
    handle = session['handle']
    node_key = f"{handle}_{node_id}"
    
    # Get existing data
    node_data = get_node_data(node_key) or {}
    
    # Update config
    node_data['config'] = config
    
    # Save back
    save_node_id(
        node_key,
        node_data.get('component_id', ''),
        node_data.get('title', node['name']),
        node_data.get('description', node['description']),
        config,
        node_data.get('color')
    )
    
    return jsonify({'success': True})

@app.route('/api/session')
def check_session():
    """Check if logged in"""
    if 'session_cookie' in session:
        return jsonify({
            'logged_in': True,
            'handle': session.get('handle'),
            'is_admin': session.get('is_admin', False)
        })
    return jsonify({'logged_in': False})

@app.route('/docs')
def docs():
    """Documentation page"""
    return render_template('docs.html')

@app.route('/api/docs/reference')
def get_reference():
    """Get Graze reference documentation"""
    ref_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'GRAZE_REFERENCE.md')
    try:
        with open(ref_path, 'r') as f:
            content = f.read()
        return jsonify({'content': content})
    except FileNotFoundError:
        return jsonify({'error': 'Reference file not found'}), 404

@app.route('/api/docs/operations')
def get_operations():
    """Get filter operations guide"""
    ops_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'FILTER_OPERATIONS.md')
    try:
        with open(ops_path, 'r') as f:
            content = f.read()
        return jsonify({'content': content})
    except FileNotFoundError:
        return jsonify({'error': 'Operations file not found'}), 404

@app.route('/api/docs/metadata')
def get_metadata():
    """Get post metadata guide"""
    meta_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'POST_METADATA.md')
    try:
        with open(meta_path, 'r') as f:
            content = f.read()
        return jsonify({'content': content})
    except FileNotFoundError:
        return jsonify({'error': 'Metadata file not found'}), 404

@app.route('/docs/GRAZE_ACTIONS.json')
def get_actions():
    """Get actions guide"""
    actions_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'GRAZE_ACTIONS.json')
    try:
        with open(actions_path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({'error': 'Actions file not found'}), 404

@app.route('/api/nsfw/categories')
def get_nsfw_categories():
    """Get all NSFW categories"""
    categories = [
        {'id': 'creator_sites', 'name': 'Creator Sites', 'type': 'sites', 'description': 'OnlyFans, Patreon, Fansly, etc.'},
        {'id': 'xxx_sites', 'name': 'General XXX Sites', 'type': 'sites', 'description': 'Pornhub, xHamster, xVideos, etc.'},
        {'id': 'shop_sites', 'name': 'NSFW Shop Sites', 'type': 'sites', 'description': 'Adult toy shops, NSFW merchandise'},
        {'id': 'general_terms', 'name': 'General NSFW Terms', 'type': 'general', 'description': 'Common NSFW words and phrases'},
        {'id': 'creator_terms', 'name': 'Creator Terms', 'type': 'general', 'description': 'Content creator related terms'},
        {'id': 'ai_terms', 'name': 'AI Terms', 'type': 'general', 'description': 'AI-generated NSFW content terms'},
        {'id': 'art_terms', 'name': 'NSFW Art Terms', 'type': 'general', 'description': 'Artistic NSFW content terms'},
        {'id': 'misc_terms', 'name': 'Misc Terms', 'type': 'general', 'description': 'Miscellaneous NSFW terms'},
        {'id': 'straight_terms', 'name': 'Straight Terms', 'type': 'orientation', 'description': 'Heterosexual content'},
        {'id': 'gay_terms', 'name': 'Gay Terms', 'type': 'orientation', 'description': 'Gay/MLM content'},
        {'id': 'lesbian_terms', 'name': 'Lesbian/WLW Terms', 'type': 'orientation', 'description': 'Lesbian/WLW content'},
        {'id': 'bisexual_terms', 'name': 'Bisexual Terms', 'type': 'orientation', 'description': 'Bisexual content'},
        {'id': 'trans_terms', 'name': 'Trans Terms', 'type': 'orientation', 'description': 'Transgender content'},
        {'id': 'domination_terms', 'name': 'Domination Terms', 'type': 'kinks', 'description': 'BDSM, dom/sub, power dynamics'},
        {'id': 'fetish_terms', 'name': 'Fetish Terms', 'type': 'kinks', 'description': 'Various fetishes and kinks'},
        {'id': 'cuckold_terms', 'name': 'Cuckold Terms', 'type': 'kinks', 'description': 'Cuckold/hotwife content'},
        {'id': 'interracial_terms', 'name': 'Interracial Terms', 'type': 'kinks', 'description': 'Interracial content'},
        {'id': 'feet_terms', 'name': 'Feet Terms', 'type': 'kinks', 'description': 'Foot fetish content'},
        {'id': 'latex_terms', 'name': 'Latex/Leather/Rubber Terms', 'type': 'kinks', 'description': 'Latex, leather, rubber fetish'},
        {'id': 'roleplay_terms', 'name': 'Roleplay Terms', 'type': 'kinks', 'description': 'Roleplay scenarios'},
        {'id': 'anime_gaming_terms', 'name': 'Anime/Gaming Terms', 'type': 'media', 'description': 'Anime and gaming NSFW'},
        {'id': 'hentai_terms', 'name': 'Hentai Terms', 'type': 'media', 'description': 'Hentai and ecchi content'},
        {'id': 'furry_terms', 'name': 'Furry Terms', 'type': 'media', 'description': 'Furry/anthro content'},
        {'id': 'cosplay_terms', 'name': 'Cosplay Terms', 'type': 'media', 'description': 'NSFW cosplay content'},
        {'id': 'softcore_terms', 'name': 'Softcore/Suggestive Terms', 'type': 'media', 'description': 'Softcore and suggestive content'},
        {'id': 'boobs_terms', 'name': 'Boobs Terms', 'type': 'body_parts', 'description': 'Breast-related terms'},
        {'id': 'ass_terms', 'name': 'Ass Terms', 'type': 'body_parts', 'description': 'Butt-related terms'},
        {'id': 'vagina_terms', 'name': 'Vagina Terms', 'type': 'body_parts', 'description': 'Vagina-related terms'},
        {'id': 'penis_terms', 'name': 'Penis Terms', 'type': 'body_parts', 'description': 'Penis-related terms'},
        {'id': 'bbw_terms', 'name': 'BBW Terms', 'type': 'body_types', 'description': 'Big beautiful women'},
        {'id': 'curvy_terms', 'name': 'Curvy Terms', 'type': 'body_types', 'description': 'Curvy body types'},
        {'id': 'mature_terms', 'name': 'Mature/GILF Terms', 'type': 'body_types', 'description': 'Mature/older content'},
        {'id': 'milf_terms', 'name': 'MILF Terms', 'type': 'body_types', 'description': 'MILF content'},
        {'id': 'young_adult_terms', 'name': 'Young Adult (18+) Terms', 'type': 'body_types', 'description': 'Young adult (18+) content'},
        {'id': 'oral_terms', 'name': 'Oral/Blowjob Terms', 'type': 'acts', 'description': 'Oral sex acts'},
        {'id': 'anal_terms', 'name': 'Anal Terms', 'type': 'acts', 'description': 'Anal sex acts'},
        {'id': 'group_terms', 'name': 'Group/Threesome/Orgy Terms', 'type': 'acts', 'description': 'Group sex, threesomes, orgies'},
        {'id': 'solo_terms', 'name': 'Solo/Masturbation Terms', 'type': 'acts', 'description': 'Solo and masturbation content'},
        {'id': 'pregnancy_terms', 'name': 'Pregnancy/Breeding Terms', 'type': 'acts', 'description': 'Pregnancy and breeding kink'},
        {'id': 'cam_terms', 'name': 'Cam/Streaming Terms', 'type': 'acts', 'description': 'Cam shows and streaming'},
        {'id': 'sexwork_terms', 'name': 'Sex Work Terms', 'type': 'acts', 'description': 'Sex work related terms'},
        {'id': 'nudity_nonsexual_terms', 'name': 'Nudity (Non-Sexual) Terms', 'type': 'acts', 'description': 'Artistic/non-sexual nudity'}
    ]
    return jsonify(categories)

@app.route('/api/nsfw/<category>')
def get_nsfw_category(category):
    """Get terms for a specific category"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'nsfw', f'{category}.json')
    try:
        with open(data_path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({'error': 'Category not found'}), 404

@app.route('/api/nsfw/<category>', methods=['POST'])
def update_nsfw_category(category):
    """Update terms for a specific category"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'nsfw', f'{category}.json')
    try:
        data = request.json
        with open(data_path, 'w') as f:
            json.dump(data, f, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/nsfw/search/<term>')
def search_nsfw_term(term):
    """Search for a term across all categories"""
    term_lower = term.lower()
    results = []
    
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'nsfw')
    categories = get_nsfw_categories().json
    
    for cat in categories:
        cat_id = cat['id']
        data_path = os.path.join(data_dir, f'{cat_id}.json')
        try:
            with open(data_path, 'r') as f:
                data = json.load(f)
            
            # Check terms
            if data.get('terms') and any(t.lower() == term_lower for t in data['terms']):
                results.append({'category': cat['name'], 'type': 'term'})
            # Check hashtags
            elif data.get('hashtags') and any(h.lower() == term_lower for h in data['hashtags']):
                results.append({'category': cat['name'], 'type': 'hashtag'})
            # Check domains
            elif data.get('domains') and any(d.lower() == term_lower for d in data['domains']):
                results.append({'category': cat['name'], 'type': 'domain'})
        except:
            continue
    
    return jsonify(results)

@app.route('/api/adblocker/categories')
def get_adblocker_categories():
    """Get all adblocker categories"""
    categories = [
        {'id': 'universal', 'name': 'Universal', 'type': 'general', 'description': 'Universal affiliate domains and tiny URL shorteners'},
        {'id': 'ad_hashtags', 'name': 'Ad Hashtags', 'type': 'general', 'description': 'Advertisement hashtags (#ad, #sponsored, etc.)'},
        {'id': 'ad_phrases', 'name': 'Ad Phrases', 'type': 'general', 'description': 'Generic ad language (BUY NOW, 50% OFF, etc.)'},
        {'id': 'amazon', 'name': 'Amazon', 'type': 'brand', 'description': 'Amazon affiliate detection'},
        {'id': 'ebay', 'name': 'eBay', 'type': 'brand', 'description': 'eBay affiliate detection'},
        {'id': 'walmart', 'name': 'Walmart', 'type': 'brand', 'description': 'Walmart affiliate detection'},
        {'id': 'bestbuy', 'name': 'BestBuy', 'type': 'brand', 'description': 'BestBuy affiliate detection'},
        {'id': 'target', 'name': 'Target', 'type': 'brand', 'description': 'Target affiliate detection'},
        {'id': 'aliexpress', 'name': 'AliExpress', 'type': 'brand', 'description': 'AliExpress affiliate detection'},
        {'id': 'apple', 'name': 'Apple', 'type': 'brand', 'description': 'Apple affiliate detection'},
        {'id': 'travel', 'name': 'Travel', 'type': 'brand', 'description': 'Travel site affiliate detection'},
        {'id': 'rakuten', 'name': 'Rakuten', 'type': 'brand', 'description': 'Rakuten affiliate detection'},
        {'id': 'clickbank', 'name': 'ClickBank', 'type': 'brand', 'description': 'ClickBank link detection'}
    ]
    return jsonify(categories)

@app.route('/api/adblocker/<category>')
def get_adblocker_category(category):
    """Get data for a specific adblocker category"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'adblocker', f'{category}.json')
    try:
        with open(data_path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({'error': 'Category not found'}), 404

@app.route('/api/adblocker/<category>', methods=['POST'])
def update_adblocker_category(category):
    """Update data for a specific adblocker category"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'adblocker', f'{category}.json')
    try:
        data = request.json
        with open(data_path, 'w') as f:
            json.dump(data, f, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/adblocker/search/<term>')
def search_adblocker_term(term):
    """Search for a term across all adblocker categories"""
    term_lower = term.lower()
    results = []
    
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'adblocker')
    categories = get_adblocker_categories().json
    
    for cat in categories:
        cat_id = cat['id']
        data_path = os.path.join(data_dir, f'{cat_id}.json')
        try:
            with open(data_path, 'r') as f:
                data = json.load(f)
            
            # Check different field types based on category
            if data.get('domains') and any(d.lower() == term_lower for d in data['domains']):
                results.append({'category': cat['name'], 'type': 'domain'})
            elif data.get('affiliate_tags') and any(t.lower() == term_lower for t in data['affiliate_tags']):
                results.append({'category': cat['name'], 'type': 'affiliate_tag'})
            elif data.get('keywords') and any(k.lower() == term_lower for k in data['keywords']):
                results.append({'category': cat['name'], 'type': 'keyword'})
            elif data.get('affiliate_domains') and any(d.lower() == term_lower for d in data['affiliate_domains']):
                results.append({'category': cat['name'], 'type': 'affiliate_domain'})
            elif data.get('tiny_url_shorteners') and any(u.lower() == term_lower for u in data['tiny_url_shorteners']):
                results.append({'category': cat['name'], 'type': 'tiny_url'})
            elif data.get('hashtags') and any(h.lower() == term_lower for h in data['hashtags']):
                results.append({'category': cat['name'], 'type': 'hashtag'})
            elif data.get('phrases') and any(p.lower() == term_lower for p in data['phrases']):
                results.append({'category': cat['name'], 'type': 'phrase'})
        except:
            continue
    
    return jsonify(results)

@app.route('/api/ai/config', methods=['GET'])
def get_ai_config():
    """Get AI configuration status"""
    if 'handle' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    handle = session['handle']
    api_key = get_api_key(handle)
    
    return jsonify({
        'has_api_key': api_key is not None,
        'api_key_preview': f"{api_key[:8]}..." if api_key else None
    })

@app.route('/api/ai/config', methods=['POST'])
def save_ai_config():
    """Save AI configuration"""
    if 'handle' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    api_key = data.get('api_key', '').strip()
    
    if not api_key:
        return jsonify({'error': 'API key required'}), 400
    
    handle = session['handle']
    save_api_key(handle, api_key)
    
    return jsonify({'success': True})

@app.route('/api/ai/suggest', methods=['POST'])
def ai_suggest():
    """Generate AI suggestions for a category"""
    if 'handle' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    category = data.get('category')  # 'nsfw' or 'adblocker'
    filename = data.get('filename')  # e.g., 'oral_terms' or 'ad_phrases'
    force_field_type = data.get('force_field_type')  # Optional: 'terms', 'hashtags', or 'domains'
    
    if not category or not filename:
        return jsonify({'error': 'Category and filename required'}), 400
    
    # Load current data
    data_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'data',
        category,
        f'{filename}.json'
    )
    
    try:
        with open(data_path, 'r') as f:
            current_data = json.load(f)
        
        handle = session['handle']
        result = generate_suggestions(handle, category, filename, current_data, force_field_type)
        
        return jsonify({
            'success': True,
            'suggestions': result['suggestions'],
            'field_type': result['field_type']
        })
    
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'AI generation failed: {str(e)}'}), 500

@app.route('/api/ai/deny', methods=['POST'])
def ai_deny_term():
    """Mark a term as denied"""
    if 'handle' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    category = data.get('category')
    filename = data.get('filename')
    term = data.get('term')
    
    if not category or not filename or not term:
        return jsonify({'error': 'Category, filename, and term required'}), 400
    
    try:
        save_denied_term(category, filename, term)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/promo-footer', methods=['GET'])
def get_promo_footer():
    """Get user's promotional footer"""
    if 'handle' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    handle = session['handle']
    config_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'data', 'user_configs', f'{handle}_config.json'
    )
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        return jsonify({
            'footer': config.get('promotional_footer', ''),
            'enabled': config.get('promotional_footer_enabled', True)
        })
    except FileNotFoundError:
        return jsonify({'footer': '', 'enabled': True})

@app.route('/api/user/promo-footer', methods=['POST'])
def save_promo_footer():
    """Save user's promotional footer"""
    if 'handle' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    handle = session['handle']
    data = request.json
    footer = data.get('footer', '')
    enabled = data.get('enabled', True)
    
    config_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'data', 'user_configs'
    )
    os.makedirs(config_dir, exist_ok=True)
    
    config_path = os.path.join(config_dir, f'{handle}_config.json')
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        config = {}
    
    config['promotional_footer'] = footer
    config['promotional_footer_enabled'] = enabled
    
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    return jsonify({'success': True})

@app.route('/api/block-lists', methods=['GET'])
def get_block_lists():
    """Get all block lists"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'block_lists', 'lists.json')
    try:
        with open(data_path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({'lists': []})

@app.route('/api/block-lists', methods=['POST'])
def save_block_lists():
    """Save block lists"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'block_lists', 'lists.json')
    try:
        data = request.json
        with open(data_path, 'w') as f:
            json.dump(data, f, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/spam-blocker/<category>')
def get_spam_blocker_category(category):
    """Get spam blocker category data"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'spam_blocker', f'{category}.json')
    try:
        with open(data_path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({'error': 'Category not found'}), 404

@app.route('/api/spam-blocker/<category>', methods=['POST'])
def update_spam_blocker_category(category):
    """Update spam blocker category data"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'spam_blocker', f'{category}.json')
    try:
        data = request.json
        with open(data_path, 'w') as f:
            json.dump(data, f, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/test-feed/<category>')
def get_test_feed_category(category):
    """Get test feed category data"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'test_feed', f'{category}.json')
    try:
        with open(data_path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({'lists': []})

@app.route('/api/test-feed/<category>', methods=['POST'])
def update_test_feed_category(category):
    """Update test feed category data"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'test_feed', f'{category}.json')
    try:
        data = request.json
        with open(data_path, 'w') as f:
            json.dump(data, f, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/nodes/hidden_hashtag_filter/config')
def get_hidden_hashtag_config():
    """Get hidden hashtag filter config"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'hidden_hashtag_filter.json')
    try:
        with open(data_path, 'r') as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        return jsonify({'hashtags': []})

@app.route('/api/nodes/hidden_hashtag_filter/config', methods=['POST'])
def update_hidden_hashtag_config():
    """Update hidden hashtag filter config"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'hidden_hashtag_filter.json')
    try:
        data = request.json
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        with open(data_path, 'w') as f:
            json.dump(data, f, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/actions/save', methods=['POST'])
def save_action():
    """Save or update an action"""
    if not session.get('is_admin', False):
        return jsonify({'error': 'Unauthorized'}), 403
    
    action = request.json
    actions_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'GRAZE_ACTIONS.json')
    
    try:
        with open(actions_path, 'r') as f:
            actions = json.load(f)
        
        # Find and update or append
        existing_idx = next((i for i, a in enumerate(actions) if a['id'] == action['id']), None)
        if existing_idx is not None:
            actions[existing_idx] = action
        else:
            actions.append(action)
        
        with open(actions_path, 'w') as f:
            json.dump(actions, f, indent=2)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/actions/<action_id>', methods=['DELETE'])
def delete_action(action_id):
    """Delete an action"""
    if not session.get('is_admin', False):
        return jsonify({'error': 'Unauthorized'}), 403
    
    actions_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'GRAZE_ACTIONS.json')
    
    try:
        with open(actions_path, 'r') as f:
            actions = json.load(f)
        
        actions = [a for a in actions if a['id'] != action_id]
        
        with open(actions_path, 'w') as f:
            json.dump(actions, f, indent=2)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
