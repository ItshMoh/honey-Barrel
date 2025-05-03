// --- DOM Elements ---
const loadingDiv = document.getElementById('loading');
const resultsDiv = document.getElementById('results');
const errorDiv = document.getElementById('error');
const productNameEl = document.getElementById('product-name');
const productPriceEl = document.getElementById('product-price');
const comparisonMessageEl = document.getElementById('comparison-message');
const baxusLinkEl = document.getElementById('baxus-link');

// --- Functions ---
function showLoading() {
    loadingDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    errorDiv.style.display = 'none';
}

function showError(message) {
    loadingDiv.style.display = 'none';
    resultsDiv.style.display = 'none';
    errorDiv.textContent = `Error: ${message}`;
    errorDiv.style.display = 'block';
}

function showResults(data) {
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'none';

    if (data.error) {
       showError(data.error);
       return;
    }

    productNameEl.textContent = `Scraped: ${data.scraped?.name || 'N/A'}`;
    productPriceEl.textContent = `Scraped Price: ${data.scraped?.price ? ('$' + data.scraped.price.toFixed(2)) : 'N/A'} (${data.scraped?.volume || 'N/A'})`;

    comparisonMessageEl.textContent = data.message;
    comparisonMessageEl.className = data.comparisonClass || ''; // Add class for styling

    if (data.baxusLink) {
        // Construct the full BAXUS URL (assuming nftAddress is the key)
        // Adjust this URL structure if needed based on how BAXUS links work
        baxusLinkEl.href = `https://baxus.co/item/${data.baxusNftAddress}`; // Adjust URL structure as needed
        baxusLinkEl.style.display = 'inline-block'; // Make link visible
    } else {
        baxusLinkEl.style.display = 'none'; // Hide link if no specific item found
    }

    resultsDiv.style.display = 'block';
}


// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    showLoading();

    // Get current tab URL and send message to background script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab && currentTab.url && currentTab.id) {
            // Check if the URL is potentially an e-commerce site (basic check)
            if (!currentTab.url.startsWith('http://') && !currentTab.url.startsWith('https://')) {
                 showError("Cannot check prices on this type of page (e.g., chrome://). Please navigate to a retail website.");
                 return;
            }

             console.log(`Popup: Sending 'checkPrice' for URL: ${currentTab.url}`);
             chrome.runtime.sendMessage(
                { action: "checkPrice", url: currentTab.url },
                (response) => {
                    if (chrome.runtime.lastError) {
                        // Handle potential errors during message sending/receiving
                        console.error("Popup Error:", chrome.runtime.lastError.message);
                        showError(`Communication error: ${chrome.runtime.lastError.message}`);
                        return;
                    }
                    if (response) {
                         console.log("Popup: Received response:", response);
                        showResults(response);
                    } else {
                        console.error("Popup: Received undefined response from background.");
                        showError("Received no response from the background script.");
                    }
                }
            );
        } else {
            showError("Could not get active tab information.");
        }
    });
});

// Listener for potential updates pushed from background (optional)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updatePopup") {
        console.log("Popup: Received update:", message.data);
        showResults(message.data);
    }
     // Keep the message channel open for asynchronous responses if needed elsewhere
     // return true;
});