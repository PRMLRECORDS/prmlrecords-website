/**
 * PRML Records — Claude Admin Utility
 * Shared across all AI-powered admin pages.
 * API key stored in localStorage under 'prml_claude_key'.
 */

const ClaudeAdmin = (() => {
  const MODEL = 'claude-haiku-4-5-20251001';
  const API_URL = 'https://api.anthropic.com/v1/messages';

  function getKey() {
    return localStorage.getItem('prml_claude_key') || '';
  }

  function hasKey() {
    return !!getKey();
  }

  async function ask(systemPrompt, userPrompt, opts = {}) {
    const key = getKey();
    if (!key) throw new Error('No Anthropic API key set. Go to Settings → AI Settings to add it.');

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.model || MODEL,
        max_tokens: opts.maxTokens || 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  // ── Prebuilt calls ────────────────────────────────────────────────────────

  async function morningBrief(context = '') {
    return ask(
      'You are an AI assistant for PRML Records LLC, an independent music label and creative studio in Atlanta, GA owned by SEAUX9/FLY. Be direct, tactical, and founder-focused.',
      `Generate a concise morning briefing for PRML Records. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}. ${context ? 'Context: ' + context : ''}\n\nInclude: 1 motivational insight for the day, 3 priority actions for an indie label founder, 1 music industry trend to watch. Keep it under 200 words. Use a direct, no-fluff tone.`,
      { maxTokens: 512 }
    );
  }

  async function generateHashtags(topic) {
    const raw = await ask(
      'You are a social media expert for PRML Records, an independent hip-hop/creative label in Atlanta.',
      `Generate 20 Instagram hashtags for a post about: "${topic}". Mix high-volume (#music, #hiphop), mid-tier (#atlantamusic, #indielabel), and niche tags (#prmlrecords). Return ONLY a JSON array of strings, no explanation.`,
      { maxTokens: 400 }
    );
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : raw.split('\n').filter(Boolean);
    } catch {
      return raw.split('\n').map(l => l.replace(/[^#\w]/g, '')).filter(Boolean);
    }
  }

  async function generateContentPlan(week = '') {
    return ask(
      'You are a content strategist for PRML Records, an independent music label and creative studio in Atlanta owned by SEAUX9/FLY. Platforms: Instagram, TikTok, YouTube.',
      `Create a 7-day content calendar for PRML Records. ${week ? 'Week of: ' + week + '.' : ''} Include: platform, content type, caption hook, best post time (EST). Format as a clean list. Focus on authentic, founder-led content that builds the PRML brand and drives sales.`,
      { maxTokens: 1200 }
    );
  }

  async function summarizeNews(headlines) {
    return ask(
      'You are a music industry analyst briefing the founder of PRML Records, an independent label in Atlanta.',
      `Summarize these music industry headlines and explain what each means specifically for PRML Records as an indie label:\n\n${headlines}\n\nBe direct and tactical. What should they do or watch out for based on this news?`,
      { maxTokens: 800 }
    );
  }

  async function analyzeCompetitor(name, notes = '') {
    return ask(
      'You are a competitive intelligence analyst for PRML Records, an independent Atlanta music label.',
      `Analyze this competitor/peer label or artist and give 3 tactical insights PRML Records can act on:\n\nName: ${name}\n${notes ? 'Notes: ' + notes : ''}\n\nFocus on: what they do well, gaps PRML can exploit, one specific action PRML should take this month.`,
      { maxTokens: 600 }
    );
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  function setLoading(btn, isLoading, originalText) {
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
    } else {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  function showResult(el, html, isError = false) {
    el.className = isError ? 'status status-err' : 'status status-ok';
    el.innerHTML = html;
  }

  function requireKey(redirectToSettings = true) {
    if (!hasKey()) {
      if (redirectToSettings) {
        const go = confirm('Anthropic API key not set. Go to Settings to add it?');
        if (go) window.location.href = 'settings.html';
      }
      return false;
    }
    return true;
  }

  return { ask, morningBrief, generateHashtags, generateContentPlan, summarizeNews, analyzeCompetitor, setLoading, showResult, requireKey, hasKey, getKey };
})();
