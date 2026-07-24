<template>
  <div>
    <!-- Main Tab Navigation -->
    <div class="sub-tab-navigation">
      <button 
        @click="mainTab = 'settings'" 
        :class="{ active: mainTab === 'settings' }"
        class="sub-tab-btn"
        title="Configuration Settings"
      >
        <svg class="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span class="sub-tab-label">Settings</span>
      </button>
      <button 
        @click="mainTab = 'commands'" 
        :class="{ active: mainTab === 'commands' }"
        class="sub-tab-btn"
        title="Available Commands"
      >
        <svg class="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12l2 2 4-4"/>
          <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
          <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
          <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"/>
          <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"/>
        </svg>
        <span class="sub-tab-label">Commands</span>
      </button>
      <button 
        @click="mainTab = 'logs'" 
        :class="{ active: mainTab === 'logs' }"
        class="sub-tab-btn"
        title="System Logs"
      >
        <svg class="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
        <span class="sub-tab-label">Logs</span>
      </button>
    </div>
    
    <!-- Tab Content -->
    <div class="tab-content">
    <!-- Settings Tab -->
    <div v-if="mainTab === 'settings'" class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-left">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <h3>Ozone Configuration</h3>
          </div>
        </div>
        <p class="card-description">Configure how reports to the ModMaster labeler affect your feeds. Report actions and commands executed in "other" report types take action on your feeds based on configuration. The system parses who made the report and does a lookup for that user's feeds.</p>
        <div class="system-explanation">
          <p><strong>How it works:</strong></p>
          <ul>
            <li><strong>Feed Owners:</strong> When you report content, configured actions execute on your feeds based on your settings below. Use any of the "other" report types to type commands. The system checks the reporting user from ozone and makes the connection to your feeds and settings.</li>
            <li><strong>Regular Users:</strong> Reports from non modmaster app users count towards communal moderation thresholds (with a setting to count their reports at reduced weights compared to other modmaster users) but don't execute direct actions on feeds</li>
            <li><strong>Moderation:</strong> Modmaster users who have been granted moderation permissions via the groups system can moderate other modmaster users feeds, by commands only.</li>
          </ul>
        </div>
      </div>
        <div class="card-content">
        <h4>Labeler Configuration</h4>
        <p class="help-text">
          Configure ModMaster and custom labelers for your feeds.
        </p>

        <!-- Labeler Sub-tabs -->
        <div class="sub-tab-navigation">
          <button 
            @click="labelerTab = 'modmaster'"
            :class="{ active: labelerTab === 'modmaster' }"
            class="sub-tab-btn"
          >
            <span class="sub-tab-label">ModMaster</span>
          </button>
          <button 
            @click="labelerTab = 'custom'"
            :class="{ active: labelerTab === 'custom' }"
            class="sub-tab-btn"
          >
            <span class="sub-tab-label">Custom</span>
          </button>
        </div>

        <!-- ModMaster Tab -->
        <div v-if="labelerTab === 'modmaster'" class="labeler-content">
          <div class="setting-row">
            <div class="toggle-setting">
              <span>Enable ModMaster Labeler</span>
              <label class="toggle">
                <input type="checkbox" v-model="modmasterSettings.enabled" @change="saveModmasterSettings">
                <span class="slider"></span>
              </label>
            </div>
          </div>
          
          <div v-if="modmasterSettings.enabled" class="labeler-actions">
            <div class="setting-row">
              <label>ModMaster report weight: {{ Number(modmasterSettings.weight || 1.0).toFixed(2) }}</label>
              <input 
                type="range" 
                v-model.number="modmasterSettings.weight" 
                min="0" 
                max="1" 
                step="0.05"
                @change="saveModmasterSettings"
              />
              <span class="weight-hint">0 = ignored, 1 = full weight in communal moderation</span>
            </div>

            <!-- Action Sub-tabs -->
            <div class="sub-tab-navigation">
              <button 
                @click="actionTab = 'posts'"
                :class="{ active: actionTab === 'posts' }"
                class="sub-tab-btn"
              >
                <span class="sub-tab-label">Posts</span>
              </button>
              <button 
                @click="actionTab = 'users'"
                :class="{ active: actionTab === 'users' }"
                class="sub-tab-btn"
              >
                <span class="sub-tab-label">Users</span>
              </button>
            </div>
            
            <div class="action-help-text">
              <p v-if="actionTab === 'posts'">
                <strong>Post Reports:</strong> Actions to take when posts are reported for these reasons.
              </p>
              <p v-if="actionTab === 'users'">
                <strong>User Reports:</strong> Actions to take when user accounts are reported for these reasons.
              </p>
            </div>

            <div class="report-categories">
              <div v-for="(category, categoryKey) in reportTypes" :key="categoryKey" class="category-section">
                <h5 class="category-title">{{ category.name }}</h5>
                <div class="report-types">
                  <div v-for="(subName, subKey) in category.subcategories" :key="subKey" class="report-type-row">
                    <label>{{ subName }}</label>
                    <div v-if="!isCommandOnlyType(subKey)">
                      <select 
                        v-model="modmasterReportSettings[actionTab][subKey]" 
                        @change="handleModmasterSettingChange(subKey, actionTab)"
                        :disabled="modmasterReportSettings[actionTab][subKey] === 'command_only'"
                      >
                        <template v-if="actionTab === 'posts'">
                          <option value="remove_all_account">Remove from ALL account feeds</option>
                          <option value="remove_all_configured">Remove from all configured feeds</option>
                          <option value="remove_selected">Remove from selected feeds</option>
                        </template>
                        <template v-if="actionTab === 'users'">
                          <option value="ban_global_only">Add to global ban list only</option>
                          <option value="ban_all_feeds">Add to all feed ban lists</option>
                          <option value="ban_global_and_feeds">Add to global + all feed lists</option>
                          <option value="ban_selected">Add to selected feed lists</option>
                        </template>
                        <option value="log_only">Log only (no action)</option>
                        <option value="command_only" disabled>Commands only</option>
                      </select>
                      <div v-if="(modmasterReportSettings[actionTab][subKey] === 'remove_selected' || modmasterReportSettings[actionTab][subKey] === 'ban_selected') && getSelectedFeeds('modmaster', actionTab, subKey).length > 0" class="selected-feeds-display">
                        <span class="selected-feeds-label">Selected feeds:</span>
                        <span class="selected-feeds-list">{{ getSelectedFeeds('modmaster', actionTab, subKey).map(id => getFeedName(id)).join(', ') }}</span>
                      </div>
                    </div>
                    <span v-if="isCommandOnlyType(subKey)" class="command-only-fixed">
                      Commands only (hardcoded)
                    </span>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Custom Labeler Tab -->
        <div v-if="labelerTab === 'custom'" class="labeler-content">
          <div v-if="!customLabeler.configured" class="form-group">
            <label>Labeler DID</label>
            <input 
              v-model="customLabeler.did" 
              type="text" 
              placeholder="did:plc:your-labeler-did"
            />

            <label>Ozone URL</label>
            <input 
              v-model="customLabeler.ozoneUrl" 
              type="text" 
              placeholder="https://your-ozone.example.com"
            />

            <label>App Password</label>
            <input 
              v-model="customLabeler.password" 
              type="password" 
              placeholder="Your labeler app password"
            />

            <button @click="saveCustomLabeler" :disabled="saving" class="btn-primary">
              {{ saving ? 'Saving...' : 'Configure Custom Labeler' }}
            </button>
          </div>

          <div v-else class="configured">
            <p><strong>DID:</strong> {{ customLabeler.did }}</p>
            <p><strong>Ozone URL:</strong> {{ customLabeler.ozoneUrl }}</p>
            <button @click="removeCustomLabeler" :disabled="saving" class="btn-danger">
              {{ saving ? 'Removing...' : 'Remove Custom Labeler' }}
            </button>

            <div class="labeler-actions">
              <!-- Action Sub-tabs -->
              <div class="sub-tab-navigation">
                <button 
                  @click="actionTab = 'posts'"
                  :class="{ active: actionTab === 'posts' }"
                  class="sub-tab-btn"
                >
                  <span class="sub-tab-label">Posts</span>
                </button>
                <button 
                  @click="actionTab = 'users'"
                  :class="{ active: actionTab === 'users' }"
                  class="sub-tab-btn"
                >
                  <span class="sub-tab-label">Users</span>
                </button>
              </div>
              
              <div class="action-help-text">
                <p v-if="actionTab === 'posts'">
                  <strong>Post Reports:</strong> Actions to take when posts are reported for these reasons.
                </p>
                <p v-if="actionTab === 'users'">
                  <strong>User Reports:</strong> Actions to take when user accounts are reported for these reasons.
                </p>
              </div>

              <div class="report-categories">
                <div v-for="(category, categoryKey) in reportTypes" :key="categoryKey" class="category-section">
                  <h5 class="category-title">{{ category.name }}</h5>
                  <div class="report-types">
                    <div v-for="(subName, subKey) in category.subcategories" :key="subKey" class="report-type-row">
                      <label>{{ subName }}</label>
                      <div v-if="!isCommandOnlyType(subKey)">
                        <select 
                          v-model="customReportSettings[actionTab][subKey]" 
                          @change="handleCustomSettingChange(subKey, actionTab)"
                          :disabled="customReportSettings[actionTab][subKey] === 'command_only'"
                        >
                          <template v-if="actionTab === 'posts'">
                            <option value="remove_all_account">Remove from ALL account feeds</option>
                            <option value="remove_all_configured">Remove from all configured feeds</option>
                            <option value="remove_selected">Remove from selected feeds</option>
                          </template>
                          <template v-if="actionTab === 'users'">
                            <option value="ban_global_only">Add to global ban list only</option>
                            <option value="ban_all_feeds">Add to all feed ban lists</option>
                            <option value="ban_global_and_feeds">Add to global + all feed lists</option>
                            <option value="ban_selected">Add to selected feed lists</option>
                          </template>
                          <option value="log_only">Log only (no action)</option>
                          <option value="command_only" disabled>Commands only</option>
                        </select>
                        <div v-if="(customReportSettings[actionTab][subKey] === 'remove_selected' || customReportSettings[actionTab][subKey] === 'ban_selected') && getSelectedFeeds('custom', actionTab, subKey).length > 0" class="selected-feeds-display">
                          <span class="selected-feeds-label">Selected feeds:</span>
                          <span class="selected-feeds-list">{{ getSelectedFeeds('custom', actionTab, subKey).map(id => getFeedName(id)).join(', ') }}</span>
                        </div>
                      </div>
                      <span v-if="isCommandOnlyType(subKey)" class="command-only-fixed">
                        Commands only (hardcoded)
                      </span>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="modmasterSettings.enabled" class="section-separator"></div>
        
        <div v-if="modmasterSettings.enabled">
          <h4>Non-User Report Weights</h4>
          <p class="help-text">
            How much should reports from non-app users count toward communal thresholds?
          </p>

          <div class="weight-controls">
            <div class="weight-group">
              <label>Post Removal Weight: {{ Number(nonUserWeights.postWeight || 0.5).toFixed(2) }}</label>
              <input 
                type="range" 
                v-model.number="nonUserWeights.postWeight" 
                min="0" 
                max="1" 
                step="0.05"
                @change="saveNonUserWeights"
              />
              <span class="weight-hint">0 = ignored, 1 = full weight</span>
            </div>

            <div class="weight-group">
              <label>User Ban Weight: {{ Number(nonUserWeights.banWeight || 0.5).toFixed(2) }}</label>
              <input 
                type="range" 
                v-model.number="nonUserWeights.banWeight" 
                min="0" 
                max="1" 
                step="0.05"
                @change="saveNonUserWeights"
              />
              <span class="weight-hint">0 = ignored, 1 = full weight</span>
            </div>
          </div>
        </div>

        <div v-if="message" :class="['message', messageType]">
          {{ message }}
        </div>
        </div>
      </div>
      
      <!-- Commands Tab -->
      <div v-if="mainTab === 'commands'" class="card">
        <div class="card-header">
          <div class="card-title">
            <div class="card-title-left">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4"/>
                <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"/>
                <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"/>
              </svg>
              <h3>Available Commands</h3>
            </div>
          </div>
          <p class="card-description">Commands available for different report types across labelers.</p>
        </div>
        <div class="card-content">
          <div class="commands-info">
            <div class="command-section">
              <h4>Commands by Report Type</h4>
              <p class="help-text">Command behavior depends on whether you're reporting a post or an account:</p>
              
              <div class="report-type-section">
                <h5>
                  <svg class="report-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10,9 9,9 8,9"/>
                  </svg>
                  Post Reports (Reporting a specific post)
                </h5>
                <div class="command-list">
                  <div class="command-item">
                    <strong>Remove/Restore Commands:</strong>
                    <ul>
                      <li><code>remove</code> / <code>restore</code> - All configured feeds</li>
                      <li><code>remove feed1,feed2</code> / <code>restore feed1,feed2</code> - Specific feeds</li>
                      <li><code>remove g mygroup</code> / <code>restore g mygroup</code> - All feeds in group</li>
                      <li><code>remove all</code> / <code>restore all</code> - ALL feeds associated with your account</li>
                    </ul>
                  </div>
                  <div class="command-item">
                    <strong>Ban/Unban Commands:</strong>
                    <ul>
                      <li><code>ban</code> / <code>unban</code> - Ban post author from global list (post stays visible)</li>
                      <li><code>ban feed1,feed2</code> / <code>unban feed1,feed2</code> - Ban post author from specific feeds</li>
                      <li><code>ban g mygroup</code> / <code>unban g mygroup</code> - Ban post author from all feeds in group</li>
                      <li><code>ban all</code> / <code>unban all</code> - Ban post author from global + all feeds</li>
                    </ul>
                    <p class="command-note">Note: Ban adds users to Bluesky ban lists - their posts will eventually be removed but this can be slow. Use <code>remove</code> for instant targeted post removal.</p>
                  </div>
                  <div class="command-item">
                    <strong>Bulk Commands:</strong>
                    <ul>
                      <li><code>bulk remove</code> / <code>bulk restore</code> - Last 10 posts (default) from/to configured feeds</li>
                      <li><code>bulk remove 50</code> / <code>bulk restore 25</code> - Specified number of posts from/to configured feeds</li>
                      <li><code>bulk remove feed1,feed2 30</code> / <code>bulk restore feed1,feed2 15</code> - From/to specific feeds</li>
                      <li><code>bulk remove g mygroup 40</code> / <code>bulk restore g mygroup 20</code> - From/to all feeds in group</li>
                      <li><code>bulk remove all 50</code> / <code>bulk restore all 25</code> - From/to ALL account feeds</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div class="report-type-section">
                <h5>
                  <svg class="report-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Account Reports (Reporting a user account)
                </h5>
                <div class="command-list">
                  <div class="command-item">
                    <strong>Remove/Restore Commands:</strong>
                    <ul>
                      <li><code>remove</code> / <code>restore</code> - <span class="ignored-command">Ignored (no specific post to target)</span></li>
                    </ul>
                  </div>
                  <div class="command-item">
                    <strong>Ban/Unban Commands:</strong>
                    <ul>
                      <li><code>ban</code> / <code>unban</code> - Ban reported user from global list</li>
                      <li><code>ban feed1,feed2</code> / <code>unban feed1,feed2</code> - Ban reported user from specific feeds</li>
                      <li><code>ban g mygroup</code> / <code>unban g mygroup</code> - Ban reported user from all feeds in group</li>
                      <li><code>ban all</code> / <code>unban all</code> - Ban reported user from global + all feeds</li>
                    </ul>
                  </div>
                  <div class="command-item">
                    <strong>Bulk Commands:</strong>
                    <ul>
                      <li><code>bulk remove</code> / <code>bulk restore</code> - Last 10 posts (default) from/to configured feeds</li>
                      <li><code>bulk remove 50</code> / <code>bulk restore 25</code> - Specified number of posts from/to configured feeds</li>
                      <li><code>bulk remove feed1,feed2 30</code> / <code>bulk restore feed1,feed2 15</code> - From/to specific feeds</li>
                      <li><code>bulk remove g mygroup 40</code> / <code>bulk restore g mygroup 20</code> - From/to all feeds in group</li>
                      <li><code>bulk remove all 50</code> / <code>bulk restore all 25</code> - From/to ALL account feeds</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="command-section">
              <h4>Custom Labeler Commands</h4>
              <p class="help-text">Additional commands available when using custom labelers:</p>
              <div class="command-list">
                <div class="command-item">
                  <strong>Label Commands:</strong>
                  <ul>
                    <li><code>label label1,label2</code> - Apply multiple labels</li>
                    <li><code>unlabel label1,label2</code> - Remove multiple labels</li>
                  </ul>
                </div>
              </div>
            </div>
            

            
            <div class="command-section">
              <h4>Key Notes</h4>
              <div class="custom-features">
                <div class="feature-item">
                  <strong>Configured vs All:</strong> "Configured" = feeds in this app, "All" = every feed you own (including external)
                </div>
                <div class="feature-item">
                  <strong>Groups:</strong> Use "g groupname" to target all feeds in a group. You can target groups you own or have moderator permissions for
                </div>
                <div class="feature-item">
                  <strong>Group Syntax:</strong> "group groupname" and "group:groupname" also work, "g" is just the quicker version
                </div>
                <div class="feature-item">
                  <strong>Bulk Limits:</strong> Maximum 100 posts per operation, default 10 if not specified
                </div>
                <div class="feature-item">
                  <strong>Multiple Commands:</strong> Use multiple lines for different commands on the same report
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Logs Tab -->
      <div v-if="mainTab === 'logs'" class="card">
        <div class="card-header">
          <div class="card-title">
            <div class="card-title-left">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              <h3>Ozone Logs</h3>
            </div>
          </div>
          <p class="card-description">View report processing logs from ModMaster and custom labelers.</p>
        </div>
        <div class="card-content">
        <!-- Log Sub-tabs -->
        <div class="sub-tab-navigation">
          <button 
            @click="logTab = 'modmaster'"
            :class="{ active: logTab === 'modmaster' }"
            class="sub-tab-btn"
          >
            <span class="sub-tab-label">ModMaster</span>
          </button>
          <button 
            @click="logTab = 'custom'"
            :class="{ active: logTab === 'custom' }"
            class="sub-tab-btn"
          >
            <span class="sub-tab-label">Custom</span>
          </button>
        </div>
        
        <div class="logs-content">
          <div v-if="logTab === 'modmaster'" class="log-section">
            <h4>ModMaster Report Processing Logs</h4>
            <div class="log-entries">
              <div v-if="modmasterLogs.length === 0" class="no-logs">
                No ModMaster logs found. Logs: {{ modmasterLogs.length }}
              </div>
              <div v-for="log in modmasterLogs" :key="log.id" class="log-entry">
                <div class="log-header">
                  <span class="log-time">{{ formatTime(log.created_at) }}</span>
                  <span :class="['log-status', log.status]">{{ log.status }}</span>
                </div>
                <div class="log-details">
                  <p v-if="log.target_handle && log.target_did"><strong>Target:</strong> {{ log.target_handle }} (DID: {{ log.target_did }})</p>
                  <p v-else-if="log.target_handle"><strong>User:</strong> @{{ log.target_handle }}</p>
                  <p v-else-if="log.post_uri"><strong>Post:</strong> <a :href="log.post_uri" target="_blank">{{ log.post_uri }}</a></p>
                  <p><strong>Report Type:</strong> {{ log.report_type }}</p>
                  <p><strong>Action Taken:</strong> {{ log.action_taken }}</p>
                  <p v-if="log.feed_id"><strong>Feed:</strong> {{ getFeedName(log.feed_id) }}</p>
                  <p><strong>Status:</strong> {{ log.status }}</p>
                  <p><strong>Timestamp:</strong> {{ formatTime(log.created_at) }}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="logTab === 'custom'" class="log-section">
            <h4>Custom Labeler Report Processing Logs</h4>
            <div class="log-entries">
              <div v-for="log in customLogs" :key="log.id" class="log-entry">
                <div class="log-header">
                  <span class="log-time">{{ formatTime(log.created_at) }}</span>
                  <span :class="['log-status', log.status]">{{ log.status }}</span>
                </div>
                <div class="log-details">
                  <p v-if="log.target_handle && log.target_did"><strong>Target:</strong> {{ log.target_handle }} (DID: {{ log.target_did }})</p>
                  <p v-else-if="log.target_handle"><strong>User:</strong> @{{ log.target_handle }}</p>
                  <p v-else-if="log.post_uri"><strong>Post:</strong> <a :href="log.post_uri" target="_blank">{{ log.post_uri }}</a></p>
                  <p><strong>Report Type:</strong> {{ log.report_type }}</p>
                  <p><strong>Action Taken:</strong> {{ log.action_taken }}</p>
                  <p v-if="log.feed_id"><strong>Feed:</strong> {{ getFeedName(log.feed_id) }}</p>
                  <p><strong>Status:</strong> {{ log.status }}</p>
                  <p><strong>Timestamp:</strong> {{ formatTime(log.created_at) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- Feed Selection Modal -->
    <div v-if="showFeedSelector" class="modal-overlay" @click="showFeedSelector = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Select Feeds</h3>
          <button @click="showFeedSelector = false" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <p>Choose which feeds this setting should apply to:</p>
          <div class="feed-list">
            <label v-for="feed in feeds" :key="feed.feed_id" class="feed-checkbox">
              <input 
                type="checkbox" 
                :value="feed.feed_id" 
                v-model="selectedFeeds"
              />
              <span>{{ feed.feed_name }}</span>
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="showFeedSelector = false" class="btn-secondary">Cancel</button>
          <button @click="saveFeedSelection" class="btn-primary">Save Selection</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'

const authStore = useAuthStore()
const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

const customLabeler = ref({
  configured: false,
  did: '',
  ozoneUrl: '',
  password: ''
})

const reportTypes = ref({})
const feeds = ref([])
const mainTab = ref('settings')
const labelerTab = ref('modmaster')
const actionTab = ref('posts')
const logTab = ref('modmaster')
const modmasterLogs = ref([])
const customLogs = ref([])
const modmasterReportSettings = ref<Record<string, Record<string, string>>>({
  posts: {},
  users: {}
})
const customReportSettings = ref<Record<string, Record<string, string>>>({
  posts: {},
  users: {}
})
const modmasterSettings = ref({
  enabled: true,
  weight: 1.0
})
const nonUserWeights = ref({
  postWeight: 0.5,
  banWeight: 0.5
})
const showFeedSelector = ref(false)
const selectedFeeds = ref([])
const currentSettingKey = ref('')
const currentLabelerType = ref('')
const feedSelections = ref<Record<string, string[]>>({})

onMounted(async () => {
  await loadReportTypes()
  await loadFeeds()
  await loadCustomLabeler()
  await loadModmasterSettings()
  await loadModmasterReportSettings()
  await loadCustomReportSettings()
  await loadNonUserWeights()
  await loadLogs()
})

async function loadFeeds() {
  try {
    const response = await axios.get('/api/feeds', {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    feeds.value = response.data
  } catch (error) {
    console.error('Failed to load feeds:', error)
  }
}

function getFeedName(feedId: string): string {
  const feed = feeds.value.find(f => f.feed_id === feedId)
  return feed ? feed.feed_name : feedId
}

async function loadReportTypes() {
  try {
    const response = await axios.get('/api/report-types/hierarchical')
    reportTypes.value = response.data.reportTypes
  } catch (error) {
    console.error('Failed to load report types:', error)
  }
}

async function loadCustomLabeler() {
  try {
    const response = await axios.get(`/api/modmaster/custom-labeler/${authStore.user?.id}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    
    if (response.data.configured) {
      customLabeler.value = {
        configured: true,
        did: response.data.labelerDid,
        ozoneUrl: response.data.ozoneUrl,
        password: ''
      }
    }
  } catch (error) {
    console.error('Failed to load custom labeler:', error)
  }
}

async function saveCustomLabeler() {
  saving.value = true
  try {
    await axios.post('/api/modmaster/custom-labeler', {
      userId: authStore.user?.id,
      labelerDid: customLabeler.value.did,
      ozoneUrl: customLabeler.value.ozoneUrl,
      password: customLabeler.value.password
    }, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })

    showMessage('Custom labeler configured successfully', 'success')
    await loadCustomLabeler()
  } catch (error) {
    showMessage('Error configuring custom labeler', 'error')
  } finally {
    saving.value = false
  }
}

async function removeCustomLabeler() {
  saving.value = true
  try {
    await axios.post('/api/modmaster/custom-labeler', {
      userId: authStore.user?.id,
      labelerDid: null
    }, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })

    customLabeler.value = { configured: false, did: '', ozoneUrl: '', password: '' }
    showMessage('Custom labeler removed', 'success')
  } catch (error) {
    showMessage('Error removing custom labeler', 'error')
  } finally {
    saving.value = false
  }
}

async function loadModmasterReportSettings() {
  try {
    const response = await axios.get(`/api/modmaster/report-settings/${authStore.user?.id}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    
    console.log('ModMaster settings response:', response.data)
    
    Object.keys(reportTypes.value).forEach(categoryKey => {
      const category = reportTypes.value[categoryKey]
      Object.keys(category.subcategories).forEach(subKey => {
        const defaultPost = isCommandOnlyType(subKey) ? 'command_only' : 'remove_all_configured'
        const defaultUser = isCommandOnlyType(subKey) ? 'command_only' : 'ban_global_only'
        modmasterReportSettings.value.posts[subKey] = response.data.settings?.posts?.[subKey] || defaultPost
        modmasterReportSettings.value.users[subKey] = response.data.settings?.users?.[subKey] || defaultUser
        
        // Load selected feeds
        if (response.data.selectedFeeds?.posts?.[subKey]) {
          feedSelections.value[`modmaster_posts_${subKey}`] = response.data.selectedFeeds.posts[subKey]
          console.log(`Loaded feeds for modmaster_posts_${subKey}:`, response.data.selectedFeeds.posts[subKey])
        }
        if (response.data.selectedFeeds?.users?.[subKey]) {
          feedSelections.value[`modmaster_users_${subKey}`] = response.data.selectedFeeds.users[subKey]
          console.log(`Loaded feeds for modmaster_users_${subKey}:`, response.data.selectedFeeds.users[subKey])
        }
      })
    })
  } catch (error) {
    console.error('Failed to load ModMaster report settings:', error)
  }
}

async function loadCustomReportSettings() {
  try {
    const response = await axios.get(`/api/modmaster/custom-labeler/report-settings/${authStore.user?.id}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    
    Object.keys(reportTypes.value).forEach(categoryKey => {
      const category = reportTypes.value[categoryKey]
      Object.keys(category.subcategories).forEach(subKey => {
        const defaultPost = isCommandOnlyType(subKey) ? 'command_only' : 'remove_all_configured'
        const defaultUser = isCommandOnlyType(subKey) ? 'command_only' : 'ban_global_only'
        customReportSettings.value.posts[subKey] = response.data.settings?.posts?.[subKey] || defaultPost
        customReportSettings.value.users[subKey] = response.data.settings?.users?.[subKey] || defaultUser
        
        // Load selected feeds
        if (response.data.selectedFeeds?.posts?.[subKey]) {
          feedSelections.value[`custom_posts_${subKey}`] = response.data.selectedFeeds.posts[subKey]
        }
        if (response.data.selectedFeeds?.users?.[subKey]) {
          feedSelections.value[`custom_users_${subKey}`] = response.data.selectedFeeds.users[subKey]
        }
      })
    })
  } catch (error) {
    console.error('Failed to load custom labeler report settings:', error)
  }
}

function handleModmasterSettingChange(reportType: string, targetType: string) {
  const action = modmasterReportSettings.value[targetType][reportType]
  if (action === 'remove_selected' || action === 'ban_selected') {
    currentSettingKey.value = `modmaster_${targetType}_${reportType}`
    currentLabelerType.value = 'modmaster'
    selectedFeeds.value = getSelectedFeeds('modmaster', targetType, reportType)
    showFeedSelector.value = true
  } else {
    saveModmasterReportSetting(reportType, targetType)
  }
}

function handleCustomSettingChange(reportType: string, targetType: string) {
  const action = customReportSettings.value[targetType][reportType]
  if (action === 'remove_selected' || action === 'ban_selected') {
    currentSettingKey.value = `custom_${targetType}_${reportType}`
    currentLabelerType.value = 'custom'
    selectedFeeds.value = getSelectedFeeds('custom', targetType, reportType)
    showFeedSelector.value = true
  } else {
    saveCustomReportSetting(reportType, targetType)
  }
}

function saveFeedSelection() {
  if (selectedFeeds.value.length === 0) {
    showMessage('Please select at least one feed', 'error')
    return
  }
  
  const [labelerType, targetType, reportType] = currentSettingKey.value.split('_')
  
  // Store the selected feeds
  feedSelections.value[currentSettingKey.value] = [...selectedFeeds.value]
  
  // Save the setting with selected feeds
  if (labelerType === 'modmaster') {
    saveModmasterReportSetting(reportType, targetType, selectedFeeds.value)
  } else {
    saveCustomReportSetting(reportType, targetType, selectedFeeds.value)
  }
  
  showMessage(`Setting saved for ${selectedFeeds.value.length} selected feed(s)`, 'success')
  showFeedSelector.value = false
}

function getSelectedFeeds(labelerType: string, targetType: string, reportType: string): string[] {
  const key = `${labelerType}_${targetType}_${reportType}`
  return feedSelections.value[key] || []
}

async function saveModmasterReportSetting(reportType: string, targetType: string, selectedFeedIds?: string[]) {
  try {
    const payload = {
      userId: authStore.user?.id,
      reportType,
      targetType,
      action: modmasterReportSettings.value[targetType][reportType],
      selectedFeeds: selectedFeedIds
    }
    console.log('Saving ModMaster setting:', payload)
    
    await axios.post('/api/modmaster/report-settings', payload, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })

    showMessage(`ModMaster ${targetType} setting saved`, 'success')
  } catch (error) {
    console.error('Error saving ModMaster setting:', error)
    showMessage('Error saving ModMaster setting', 'error')
  }
}

async function saveCustomReportSetting(reportType: string, targetType: string, selectedFeedIds?: string[]) {
  try {
    await axios.post('/api/modmaster/custom-labeler/report-settings', {
      userId: authStore.user?.id,
      reportType,
      targetType,
      action: customReportSettings.value[targetType][reportType],
      selectedFeeds: selectedFeedIds
    }, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })

    showMessage(`Custom labeler ${targetType} setting saved`, 'success')
  } catch (error) {
    showMessage('Error saving custom labeler setting', 'error')
  }
}

async function loadNonUserWeights() {
  try {
    const response = await axios.get(`/api/modmaster/non-user-weights/${authStore.user?.id}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    nonUserWeights.value = {
      postWeight: Number(response.data.postWeight || 0.5),
      banWeight: Number(response.data.banWeight || 0.5)
    }
  } catch (error) {
    console.error('Failed to load non-user weights:', error)
  }
}

async function saveNonUserWeights() {
  try {
    await axios.post('/api/modmaster/non-user-weights', {
      userId: authStore.user?.id,
      postWeight: nonUserWeights.value.postWeight,
      banWeight: nonUserWeights.value.banWeight
    }, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })

    showMessage('Non-user weights saved', 'success')
  } catch (error) {
    showMessage('Error saving non-user weights', 'error')
  }
}

async function loadModmasterSettings() {
  try {
    const response = await axios.get(`/api/modmaster/settings/${authStore.user?.id}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    modmasterSettings.value = { 
      ...modmasterSettings.value, 
      ...response.data,
      weight: Number(response.data.weight || 1.0)
    }
  } catch (error) {
    console.error('Failed to load ModMaster settings:', error)
  }
}

async function saveModmasterSettings() {
  try {
    await axios.post('/api/modmaster/settings', {
      userId: authStore.user?.id,
      ...modmasterSettings.value
    }, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })

    showMessage('ModMaster settings saved', 'success')
  } catch (error) {
    showMessage('Error saving ModMaster settings', 'error')
  }
}

function isCommandOnlyType(subKey: string): boolean {
  const commandOnlyTypes = ['misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other']
  return commandOnlyTypes.includes(subKey)
}

async function loadLogs() {
  try {
    console.log('Loading logs for user:', authStore.user?.id)
    const response = await axios.get(`/api/modmaster/logs/${authStore.user?.id}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    console.log('Logs response:', response.data)
    modmasterLogs.value = response.data.modmaster || []
    customLogs.value = response.data.custom || []
    console.log('ModMaster logs:', modmasterLogs.value)
  } catch (error) {
    console.error('Failed to load logs:', error)
  }
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString()
}

function showMessage(text: string, type: 'success' | 'error') {
  message.value = text
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}
</script>

<style scoped>
.card {
  background: var(--bg-card, white);
  border-radius: 2px;
  box-shadow: 0 1px 3px var(--shadow, rgba(0,0,0,0.1));
  margin-bottom: 1.5rem;
  overflow: hidden;
  border: 1px solid var(--border-primary, transparent);
}

.card-header {
  padding: 0.75rem 0.75rem 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
}

@media (min-width: 640px) {
  .card-header {
    padding: 1rem 1rem 0.75rem 1rem;
  }
}

@media (min-width: 768px) {
  .card-header {
    padding: 1.5rem 2rem 1rem 2rem;
  }
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.card-title-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.card-header h3 {
  margin: 0;
  color: var(--text-primary, #1e293b);
  font-size: 1.25rem;
  font-weight: 600;
}

.icon {
  width: 24px;
  height: 24px;
  color: #64748b;
}

.card-description {
  margin: 0;
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}

.system-explanation {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-tertiary, #f1f5f9);
  border-radius: 6px;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.system-explanation p {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary, #1e293b);
  font-weight: 600;
}

.system-explanation ul {
  margin: 0;
  padding-left: 1.5rem;
  color: var(--text-secondary, #64748b);
}

.system-explanation li {
  margin: 0.5rem 0;
  line-height: 1.4;
}

.system-explanation strong {
  color: var(--text-primary, #1e293b);
}

.card-content {
  padding: 0.75rem;
}

@media (min-width: 640px) {
  .card-content {
    padding: 1rem;
  }
}

@media (min-width: 768px) {
  .card-content {
    padding: 1.5rem 2rem;
  }
}

.section {
  background: var(--bg-secondary, #f8fafc);
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.section:last-child {
  margin-bottom: 0;
}

h4 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: var(--text-primary, #1e293b);
}

.help-text {
  color: var(--text-secondary, #64748b);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  margin-top: 0.5rem;
  color: var(--text-primary, #374151);
}

.form-group input {
  padding: 0.5rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 4px;
  background: var(--bg-primary, white);
  color: var(--text-primary, #374151);
}

.configured {
  padding: 1rem;
  background: var(--bg-tertiary, #e2e8f0);
  border-radius: 4px;
}

.configured p {
  margin: 0.5rem 0;
  color: var(--text-primary, #374151);
}

.report-categories {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.category-section {
  background: var(--bg-primary, white);
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.category-title {
  margin: 0 0 1rem 0;
  color: var(--text-primary, #1e293b);
  font-size: 1rem;
  font-weight: 600;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-primary, #e2e8f0);
}

.report-types {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.report-type-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.75rem;
  background: var(--bg-tertiary, #f8fafc);
  border-radius: 4px;
}

.report-type-row > div {
  display: flex;
  flex-direction: column;
  width: 400px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .report-type-row {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .report-type-row > div {
    width: 100%;
  }
}

.report-type-row label {
  font-weight: 500;
  flex: 1;
  color: var(--text-primary, #374151);
}

.report-type-row select {
  padding: 0.5rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 4px;
  background: var(--bg-primary, white);
  color: var(--text-primary, #374151);
  min-width: 200px;
}

.weight-controls {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.weight-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.weight-group label {
  font-weight: 500;
  color: var(--text-primary, #374151);
}

.weight-group input[type="range"] {
  width: 100%;
}

.weight-hint {
  font-size: 0.85rem;
  color: var(--text-secondary, #64748b);
}

.btn-primary, .btn-danger {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  margin-top: 1rem;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message {
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.message.success {
  background: #10b981;
  color: white;
}

.message.error {
  background: #ef4444;
  color: white;
}

.action-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.action-tab {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  font-weight: 500;
}

.action-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.action-tab:hover:not(.active) {
  color: var(--text-primary, #334155);
  background: var(--bg-tertiary, #f8fafc);
}

.modmaster-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-row label {
  font-weight: 500;
  color: var(--text-primary, #374151);
}

.setting-row select {
  padding: 0.5rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 4px;
  background: var(--bg-primary, white);
  color: var(--text-primary, #374151);
}

.modmaster-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.setting-row input[type="range"] {
  width: 100%;
}

.labeler-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.labeler-tab {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  font-weight: 500;
}

.labeler-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.labeler-tab:hover:not(.active) {
  color: var(--text-primary, #334155);
  background: var(--bg-tertiary, #f8fafc);
}

.labeler-content {
  /* Removed min-height that was causing blank space when toggle is off */
}

.labeler-actions {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary, #e2e8f0);
}

.command-only-fixed {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  font-weight: 500;
  padding: 0.5rem;
  background: var(--bg-tertiary, #f8fafc);
  border-radius: 4px;
  border: 1px solid var(--border-primary, #e2e8f0);
}

select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-primary, white);
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #e2e8f0);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary, #1e293b);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary, #64748b);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--text-primary, #1e293b);
}

.modal-content {
  padding: 1.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.feed-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.feed-checkbox:hover {
  background: var(--bg-tertiary, #f8fafc);
}

.feed-checkbox input[type="checkbox"] {
  margin: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-primary, #e2e8f0);
}

.btn-secondary {
  padding: 0.75rem 1.5rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 4px;
  background: var(--bg-primary, white);
  color: var(--text-primary, #374151);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--bg-tertiary, #f8fafc);
}

.sub-tab-navigation {
  display: flex;
  gap: 0;
  margin: 0;
  background: var(--bg-primary, white);
  padding: 0;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.tab-content {
  padding-top: 1.5rem;
}

.tab-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-right: 1px solid var(--border-primary, #e5e7eb);
}

.tab-btn:last-child {
  border-right: none;
}

.tab-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.tab-label {
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1;
}

.tab-btn.active {
  background: #3b82f6;
  color: white;
}

.tab-btn:hover:not(.active) {
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-primary, #334155);
}

.sub-tab-btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  border-right: 1px solid var(--border-primary, #e5e7eb);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.sub-tab-btn:last-child {
  border-right: none;
}

.sub-tab-icon {
  width: 18px;
  height: 18px;
}

.sub-tab-label {
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1;
}

.sub-tab-btn.active {
  background: #3b82f6;
  color: white;
}

.sub-tab-btn:hover:not(.active) {
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-primary, #334155);
}

.log-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.log-tab {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  font-weight: 500;
}

.log-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.log-tab:hover:not(.active) {
  color: var(--text-primary, #334155);
  background: var(--bg-tertiary, #f8fafc);
}

.logs-content {
  padding: 1.5rem;
}

.log-section h4 {
  margin-bottom: 1rem;
  color: var(--text-primary, #1e293b);
}

.log-entries {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 600px;
  overflow-y: auto;
}

.log-entry {
  background: var(--bg-primary, white);
  border: 1px solid var(--border-primary, #e2e8f0);
  border-radius: 6px;
  padding: 1rem;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.log-time {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
}

.log-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.log-status.success {
  background: #10b981;
  color: white;
}

.log-status.error {
  background: #ef4444;
  color: white;
}

.log-status.pending {
  background: #f59e0b;
  color: white;
}

.log-details p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: var(--text-primary, #374151);
}

.action-help-text {
  margin: 1rem 0;
  padding: 0.75rem;
  background: var(--bg-tertiary, #f1f5f9);
  border-radius: 4px;
}

.action-help-text p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
}

.toggle-setting {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-tertiary, #f8fafc);
  border-radius: 4px;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #3b82f6;
}

input:checked + .slider:before {
  transform: translateX(17px);
}

.section-separator {
  height: 1px;
  background: var(--border-primary, #e5e7eb);
  margin: 2rem 0;
}

.commands-info {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.command-section {
  background: var(--bg-tertiary, #f8fafc);
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.command-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.command-item {
  background: var(--bg-primary, white);
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.command-item strong {
  color: var(--text-primary, #1e293b);
  display: block;
  margin-bottom: 0.5rem;
}

.command-item ul {
  margin: 0;
  padding-left: 1.5rem;
  color: var(--text-secondary, #64748b);
}

.command-item li {
  margin: 0.25rem 0;
}

.command-item code {
  background: var(--bg-tertiary, #f1f5f9);
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.875em;
  color: var(--text-primary, #1e293b);
}

.command-only-types {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.type-category {
  background: var(--bg-primary, white);
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--border-primary, #e2e8f0);
  color: var(--text-secondary, #64748b);
}

.type-category strong {
  color: var(--text-primary, #1e293b);
}

.custom-features {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.feature-item {
  background: var(--bg-primary, white);
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-primary, #e2e8f0);
  color: var(--text-secondary, #64748b);
}

.feature-item strong {
  color: var(--text-primary, #1e293b);
  display: block;
  margin-bottom: 0.5rem;
}

.report-type-section {
  margin-bottom: 2rem;
}

.report-type-section h5 {
  color: var(--text-primary, #1e293b);
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-primary, #e2e8f0);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.report-type-icon {
  width: 20px;
  height: 20px;
  color: #64748b;
}

.ignored-command {
  color: #ef4444;
  font-style: italic;
  font-weight: 500;
}

.command-note {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  font-style: italic;
}

.selected-feeds-display {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--bg-tertiary, #f1f5f9);
  border-radius: 4px;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.selected-feeds-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin-right: 0.5rem;
}

.selected-feeds-list {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}
</style>