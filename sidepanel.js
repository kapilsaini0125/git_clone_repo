document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extract-bold');
  const resultsDiv = document.getElementById('results');

  extractBtn.addEventListener('click', async () => {
    try {
      extractBtn.disabled = true;
      resultsDiv.innerHTML = '<div class="loading">Extracting bold content...</div>';
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab found');
      
      const boldContent = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractMainContentBoldPhrases,
      });

      if (boldContent?.[0]?.result?.length > 0) {
       
        // youtube video function calling

        displayResults(boldContent[0].result, resultsDiv);
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

function displayResults(phrases, container) {
  const html = `
    <div class="bold-results">
      <h3>Key Bold Phrases (${phrases.length})</h3>
      <ul class="phrases-list">
        ${phrases.map(phrase => `<li>${phrase}</li>`).join('')}
      </ul>
    </div>
  `;
  container.innerHTML = html;
}