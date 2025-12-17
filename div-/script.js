// DOM Elements
let overlayBox, searchInput, searchResults;

// Initialize elements when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    overlayBox = document.getElementById('overlayBox');
    searchInput = document.getElementById('searchInput');
    searchResults = document.getElementById('searchResults');
    
    // Initialize search functionality if elements exist
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }
    
    if (overlayBox) {
        overlayBox.addEventListener('click', function(event) {
            if (event.target === overlayBox) {
                closeBox();
            }
        });
    }
    
    // Load page content for search
    loadPageContent();
});

// Store all page content for searching
const allPagesContent = {
    // This will be populated from localStorage or server
};

// Current page content
let currentPageContent = [];

// Load page content for search
function loadPageContent() {
    // Get current page content
    currentPageContent = extractPageContent();
    
    // Try to get all pages content from localStorage
    try {
        const storedContent = localStorage.getItem('allPagesSearchContent');
        if (storedContent) {
            Object.assign(allPagesContent, JSON.parse(storedContent));
        }
    } catch (e) {
        console.error('Error loading stored search content:', e);
    }
    
    // Add current page content to the collection
    const pageId = getPageId();
    allPagesContent[pageId] = {
        title: document.title,
        url: window.location.pathname,
        content: currentPageContent,
        timestamp: Date.now()
    };
    
    // Save back to localStorage (keep only recent 50 pages to avoid storage limits)
    cleanupOldPages();
    savePagesContent();
}

// Extract content from current page
function extractPageContent() {
    const content = [];
    const pageId = getPageId();
    
    // Get main content areas
    const contentSections = document.querySelectorAll('.content-section, article, main, .post, .blog-content, [role="main"]');
    
    if (contentSections.length > 0) {
        contentSections.forEach((section, index) => {
            const id = section.id || `${pageId}-section-${index}`;
            const title = section.querySelector('h1, h2, h3, h4, h5, h6')?.textContent || `Section ${index + 1}`;
            const textContent = section.textContent.trim();
            
            if (textContent && textContent.length > 20) {
                content.push({
                    id: id,
                    title: title.substring(0, 100),
                    content: textContent.substring(0, 500),
                    fullContent: textContent,
                    pageTitle: document.title,
                    pageUrl: window.location.pathname
                });
            }
        });
    } else {
        // Fallback: extract from body
        const bodyText = document.body.textContent.trim();
        if (bodyText.length > 50) {
            content.push({
                id: `${pageId}-main`,
                title: document.title,
                content: bodyText.substring(0, 500),
                fullContent: bodyText,
                pageTitle: document.title,
                pageUrl: window.location.pathname
            });
        }
    }
    
    return content;
}

// Get unique page identifier
function getPageId() {
    return window.location.pathname.replace(/\//g, '-').replace(/\.html$/, '') || 'home';
}

// Clean up old pages from storage
function cleanupOldPages() {
    const maxPages = 50; // Keep only 50 most recent pages
    const pageIds = Object.keys(allPagesContent);
    
    if (pageIds.length > maxPages) {
        // Sort by timestamp (oldest first)
        const sortedPages = pageIds.sort((a, b) => {
            return allPagesContent[a].timestamp - allPagesContent[b].timestamp;
        });
        
        // Remove oldest pages
        const pagesToRemove = sortedPages.slice(0, pageIds.length - maxPages);
        pagesToRemove.forEach(pageId => {
            delete allPagesContent[pageId];
        });
    }
}

// Save pages content to localStorage
function savePagesContent() {
    try {
        localStorage.setItem('allPagesSearchContent', JSON.stringify(allPagesContent));
    } catch (e) {
        console.error('Error saving search content:', e);
        // If storage is full, clear and try again with just current page
        if (e.name === 'QuotaExceededError') {
            localStorage.removeItem('allPagesSearchContent');
            const currentPageId = getPageId();
            const minimalContent = {};
            minimalContent[currentPageId] = allPagesContent[currentPageId];
            localStorage.setItem('allPagesSearchContent', JSON.stringify(minimalContent));
        }
    }
}

// Open search box
function openBox() {
    if (!overlayBox) {
        console.error('Search box element not found');
        return;
    }
    
    overlayBox.style.display = 'flex';
    
    if (searchInput) {
        searchInput.focus();
        searchInput.value = '';
    }
    
    if (searchResults) {
        searchResults.innerHTML = '<div class="no-results">Type to start searching across all pages...</div>';
    }
    
    // Add keyboard event listener for ESC key
    document.addEventListener('keydown', handleKeyPress);
}

// Close search box
function closeBox() {
    if (overlayBox) {
        overlayBox.style.display = 'none';
    }
    
    document.removeEventListener('keydown', handleKeyPress);
    removeHighlights();
}

// Handle keyboard events
function handleKeyPress(event) {
    // Close on ESC key
    if (event.key === 'Escape') {
        closeBox();
    }
    
    // Navigate results with arrow keys
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        navigateResults(event.key);
        event.preventDefault();
    }
    
    // Select result with Enter key
    if (event.key === 'Enter') {
        const activeResult = document.querySelector('.result-item.active');
        if (activeResult) {
            activeResult.click();
        }
    }
}

// Handle search input
function handleSearchInput() {
    if (!searchInput) return;
    
    const query = searchInput.value.trim().toLowerCase();
    
    if (query.length === 0) {
        if (searchResults) {
            searchResults.innerHTML = '<div class="no-results">Type to start searching across all pages...</div>';
        }
        removeHighlights();
        return;
    }
    
    const results = performSearch(query);
    displayResults(results, query);
}

// Perform search across all pages
function performSearch(query) {
    const results = [];
    
    // Search through all pages content
    Object.keys(allPagesContent).forEach(pageId => {
        const pageData = allPagesContent[pageId];
        
        pageData.content.forEach(item => {
            const titleMatch = item.title.toLowerCase().includes(query);
            const contentMatch = item.content.toLowerCase().includes(query);
            const fullContentMatch = item.fullContent.toLowerCase().includes(query);
            
            if (titleMatch || contentMatch || fullContentMatch) {
                // Calculate relevance score
                let relevance = 0;
                if (titleMatch) relevance += 3;
                if (contentMatch) relevance += 2;
                if (fullContentMatch) relevance += 1;
                
                // Bonus for current page
                if (pageId === getPageId()) {
                    relevance += 1;
                }
                
                results.push({
                    id: item.id,
                    title: item.title,
                    content: item.content,
                    fullContent: item.fullContent,
                    pageTitle: item.pageTitle,
                    pageUrl: item.pageUrl,
                    isCurrentPage: pageId === getPageId(),
                    relevance: relevance
                });
            }
        });
    });
    
    // Sort by relevance (highest first)
    results.sort((a, b) => b.relevance - a.relevance);
    
    return results.slice(0, 20); // Limit to 20 results
}

// Display search results
function displayResults(results, query) {
    if (!searchResults) return;
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="no-results">No results found for "' + query + '" across all pages</div>';
        removeHighlights();
        return;
    }
    
    let resultsHTML = '';
    
    results.forEach(result => {
        // Highlight matching text in preview
        const preview = highlightText(result.content, query);
        const title = highlightText(result.title, query);
        const pageIndicator = result.isCurrentPage ? 
            '<span style="font-size:0.8rem;color:#4a6ee0;margin-left:8px;">(current page)</span>' : 
            '<span style="font-size:0.8rem;color:#666;margin-left:8px;">(' + result.pageTitle + ')</span>';
        
        resultsHTML += `
            <div class="result-item" onclick="navigateToResult('${result.id}', '${result.pageUrl}', '${query.replace(/'/g, "\\'")}')">
                <div class="result-title">${title} ${pageIndicator}</div>
                <div class="result-preview">${preview}</div>
            </div>
        `;
    });
    
    searchResults.innerHTML = resultsHTML;
}

// Navigate to search result (handles both current page and other pages)
function navigateToResult(sectionId, pageUrl, query) {
    // Close search box
    closeBox();
    
    // Check if result is on current page
    const currentPageId = getPageId();
    const resultPageId = pageUrl.replace(/\//g, '-').replace(/\.html$/, '');
    
    if (resultPageId === currentPageId || pageUrl === window.location.pathname) {
        // Navigate within current page
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            highlightSectionContent(section, query);
        } else {
            // Fallback: scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } else {
        // Navigate to another page with hash
        const url = pageUrl + (sectionId ? '#' + sectionId : '');
        
        // Store search query for highlighting on the target page
        sessionStorage.setItem('searchQuery', query);
        sessionStorage.setItem('highlightSection', sectionId);
        
        // Navigate to the page
        window.location.href = url;
    }
}

// Highlight matching text in content
function highlightText(text, query) {
    if (!query || !text) return text;
    
    try {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    } catch (e) {
        return text;
    }
}

// Check for search highlights on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if we have a search query to highlight
    const searchQuery = sessionStorage.getItem('searchQuery');
    const highlightSection = sessionStorage.getItem('highlightSection');
    
    if (searchQuery && highlightSection) {
        // Wait a bit for page to fully load
        setTimeout(() => {
            const section = document.getElementById(highlightSection);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                highlightSectionContent(section, searchQuery);
            }
            
            // Clear the stored values
            sessionStorage.removeItem('searchQuery');
            sessionStorage.removeItem('highlightSection');
        }, 500);
    }
});

// Rest of your existing functions remain the same...
// [Keep all the other functions from your original code: 
// navigateResults, highlightSectionContent, getTextNodesIn, removeHighlights, etc.]
// I'm including the essential ones below:

// Navigate search results with arrow keys
function navigateResults(direction) {
    const results = document.querySelectorAll('.result-item');
    if (results.length === 0) return;
    
    let activeIndex = -1;
    results.forEach((result, index) => {
        if (result.classList.contains('active')) {
            activeIndex = index;
            result.classList.remove('active');
        }
    });
    
    if (direction === 'ArrowDown') {
        activeIndex = (activeIndex + 1) % results.length;
    } else if (direction === 'ArrowUp') {
        activeIndex = (activeIndex - 1 + results.length) % results.length;
    }
    
    if (activeIndex >= 0) {
        results[activeIndex].classList.add('active');
        results[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Highlight search terms in the section content
function highlightSectionContent(section, query) {
    // Remove previous highlights
    removeHighlights();
    
    if (!query || !section) return;
    
    // Get all text nodes in the section
    const textNodes = getTextNodesIn(section);
    
    textNodes.forEach(node => {
        const nodeText = node.nodeValue;
        try {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedQuery})`, 'gi');
            
            if (regex.test(nodeText)) {
                const newHTML = nodeText.replace(regex, '<span class="content-highlight">$1</span>');
                const newNode = document.createElement('span');
                newNode.innerHTML = newHTML;
                node.parentNode.replaceChild(newNode, node);
            }
        } catch (e) {
            console.error('Error highlighting text:', e);
        }
    });
    
    // Remove highlights after 3 seconds
    setTimeout(removeHighlights, 3000);
}

// Get all text nodes within an element
function getTextNodesIn(element) {
    const textNodes = [];
    
    function findTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node);
        } else {
            for (let i = 0; i < node.childNodes.length; i++) {
                findTextNodes(node.childNodes[i]);
            }
        }
    }
    
    findTextNodes(element);
    return textNodes;
}

// Remove all highlights from content
function removeHighlights() {
    const highlights = document.querySelectorAll('.content-highlight');
    highlights.forEach(highlight => {
        const parent = highlight.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        }
    });
}