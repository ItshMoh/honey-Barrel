// Import functions from utils
import { scrapeUrlWithFirecrawl, extractProductDetailsWithGemini, fetchBaxusListings } from '../utils/api_clients.js';
import { compareWithBaxus } from '../utils/matching_logic.js';

// --- Listener for messages from the popup ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkPrice") {
        console.log("Background: Received 'checkPrice' message for URL:", message.url);

        // Indicate that we will send a response asynchronously
        // This is crucial for keeping the message channel open while we perform async operations.
        const promise = processPriceCheck(message.url);
        promise.then(sendResponse).catch(error => {
             console.error("Background: Error during price check processing:", error);
             // Send an error response back to the popup
             sendResponse({ error: error.message || "An unknown error occurred in the background script." });
         });
        return true; // Keep the message channel open for async response
    }
    // Handle other actions if needed
    // return false; // If not handling the message or responding synchronously
});


// --- Main Async Processing Function ---
async function processPriceCheck(url) {
    console.log("Background: Starting processPriceCheck for", url);
    try {
        // 1. Scrape the URL using Firecrawl
        const markdownContent = await scrapeUrlWithFirecrawl(url);
        if (!markdownContent) {
             throw new Error("Failed to retrieve content from Firecrawl.");
        }
         console.log("Background: Scraping successful.");
        // console.log("Scraped Markdown (snippet):", markdownContent.substring(0, 500)); // Log snippet for debugging


        // 2. Extract details using Gemini
        const scrapedDetails = await extractProductDetailsWithGemini(markdownContent);
        if (!scrapedDetails || !scrapedDetails.name) {
             // Even if price/volume are null, we might proceed if name exists.
             // If name is null, Gemini likely failed significantly.
             if (!scrapedDetails?.name) {
                console.warn("Background: Gemini could not extract product name. Aborting comparison.");
                // Send specific message back if name is missing but price/volume might exist?
                // For now, treat as failure if name is missing.
                return {
                   error: "Could not identify the product name using AI. Cannot perform comparison.",
                   scraped: scrapedDetails // Send back what was extracted, if anything
                };
             }
             console.warn("Background: Gemini might have missed price or volume, but name found. Proceeding.");
        }
         console.log("Background: Gemini extraction successful:", scrapedDetails);


        // 3. Fetch BAXUS listings
        const baxusListings = await fetchBaxusListings();
         console.log(`Background: BAXUS fetch successful (${baxusListings.length} listings).`);


        // 4. Compare scraped details with BAXUS listings
        const comparisonResult = compareWithBaxus(scrapedDetails, baxusListings);
         console.log("Background: Comparison complete:", comparisonResult);


        // 5. Return the final result object for the popup
        return comparisonResult;

    } catch (error) {
         console.error("Background: Error in processPriceCheck:", error);
         // Re-throw the error so the .catch block in the listener can handle it and send to popup
         // Or return a specific error structure here
         return { error: `Processing failed: ${error.message}` };
    }
}


// --- Optional: Log installation/update events ---
chrome.runtime.onInstalled.addListener(() => {
  console.log('BAXUS Price Checker extension installed or updated.');
  // You could set default options here using chrome.storage if needed
});