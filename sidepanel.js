document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extract-bold');
  const resultsDiv = document.getElementById('results');

  extractBtn.addEventListener('click', async () => {
    try {
      extractBtn.disabled = true;
      resultsDiv.innerHTML = '<div class="loading">Extracting bold content and generating YouTube videos...</div>';
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab found');
      
      const boldContent = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractMainContentBoldPhrases,
      });

      if (boldContent?.[0]?.result?.length > 0) {
        await displayResultsWithVideos(boldContent[0].result, resultsDiv);
      } else {
        resultsDiv.innerHTML = '<div class="no-results">No bold content found in main text</div>';
      }
    } catch (error) {
      resultsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    } finally {
      extractBtn.disabled = false;
    }
  });
});

function extractMainContentBoldPhrases() {
  const MAIN_CONTENT_SELECTORS = [
    'article', 'main', 'section', 
    '.content', '.article', '.post',
    '.text', '.body', '.main-content'
  ];

  const EXCLUDE_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    '.nav', '.menu', '.sidebar', '.ad',
    '.promo', '.banner', '.footer'
  ];

  const boldPhrases = new Set();

  let mainContainer = document.body;
  MAIN_CONTENT_SELECTORS.some(selector => {
    const el = document.querySelector(selector);
    if (el) {
      mainContainer = el;
      return true;
    }
    return false;
  });

  const extractFromContainer = (container) => {
    const boldElements = Array.from(container.querySelectorAll('b, strong, h1, h2, h3, h4, h5, h6'));
    const styledBoldElements = Array.from(container.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return (style.fontWeight >= '600' || style.fontWeight === 'bold') && 
             !el.closest(EXCLUDE_SELECTORS.join(','));
    });

     [...boldElements, ...styledBoldElements].forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length > 2 && !text.match(/^\d+\s*(days|hours|minutes)$/i)) {
        boldPhrases.add(text);
      }
    });
  };

  extractFromContainer(mainContainer);
  mainContainer.querySelectorAll(MAIN_CONTENT_SELECTORS.join(',')).forEach(extractFromContainer);

  return Array.from(boldPhrases).filter(phrase => 
    phrase.split(' ').length < 8 && // Limit phrase length
    !phrase.match(/@|#|http|\d{4,}/) // Exclude special patterns
  );
}

async function displayResultsWithVideos(phrases, container) {
  container.innerHTML = `
    <div class="bold-results">
      <h3>Key Bold Phrases with YouTube Videos (${phrases.length})</h3>
      <div id="phrases-container"></div>
    </div>
  `;
  
  const phrasesContainer = document.getElementById('phrases-container');
  
  for (const phrase of phrases) {
    const phraseElement = document.createElement('div');
    phraseElement.className = 'bold-item';
    phraseElement.innerHTML = `
      <div class="phrase-header">
        <span class="bold-text">${phrase}</span>
        <button class="copy-btn" data-phrase="${escapeHtml(phrase)}">Copy</button>
      </div>
      <div class="video-loading">Loading YouTube video for "${escapeHtml(phrase)}"...</div>
    `;
    phrasesContainer.appendChild(phraseElement);
    
    try {
      const videoId = await searchYouTubeVideo(phrase);
      const videoElement = document.createElement('div');
      videoElement.className = 'video-container';
      videoElement.innerHTML = `
        <iframe 
          src="https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      `;
      
      // Replace loading message with video
      phraseElement.querySelector('.video-loading').replaceWith(videoElement);
    } catch (error) {
      const errorElement = document.createElement('div');
      errorElement.className = 'video-error';
      errorElement.textContent = `Could not load YouTube video for "${phrase}"`;
      phraseElement.querySelector('.video-loading').replaceWith(errorElement);
    }
  }
  
  // Add copy functionality
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const phrase = btn.getAttribute('data-phrase');
      navigator.clipboard.writeText(phrase).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = 'Copy';
        }, 2000);
      });
    });
  });
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function searchYouTubeVideo(query) {
  const API_KEY = 'AIzaSyAwD4vaJLnElP8Qsc8_xVqneZfkoH86KbY';
  const FALLBACK_VIDEO_ID = 'dQw4w9WgXcQ'; // Never Gonna Give You Up
  
  // Validate query
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    console.error('Invalid search query');
    return FALLBACK_VIDEO_ID;
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.append('part', 'snippet');
    url.searchParams.append('q', query.trim());
    url.searchParams.append('key', API_KEY);
    url.searchParams.append('maxResults', '1');
    url.searchParams.append('type', 'video');
    url.searchParams.append('videoEmbeddable', 'true');
    url.searchParams.append('videoSyndicated', 'true');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'YouTube API request failed');
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('No videos found for this query');
    }

    const videoId = data.items[0].id.videoId;
    if (!videoId) {
      throw new Error('No video ID found in response');
    }

    return videoId;
  } catch (error) {
    console.error('YouTube API Error:', error.message);
    return FALLBACK_VIDEO_ID;
  }
}