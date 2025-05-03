# BAXUS Price Checker Chrome Extension

## What it Does

This Chrome extension helps whisky and wine enthusiasts find the best prices for bottles. When browsing an e-commerce or retail website's product page for a specific bottle, this extension:

1.  **Scrapes Product Information:** Attempts to automatically extract the bottle's Name, Price, and Volume from the current webpage using [Firecrawl](https://firecrawl.dev/) for web scraping and the [Google Gemini API](https://ai.google.dev/docs/gemini_api_overview) for intelligent data extraction.
2.  **Queries BAXUS Marketplace:** Fetches current listings from the BAXUS marketplace API (`baxus.co`).
3.  **Compares Prices:** Cross-references the scraped bottle information with BAXUS listings to find potential matches.
4.  **Shows Results:** Displays a comparison in the extension popup:
    *   If the exact same bottle (name and volume) is found cheaper on BAXUS, it highlights the potential savings.
    *   If the exact bottle is found but isn't cheaper, it shows the BAXUS price.
    *   If an exact volume match isn't found, it may compare based on price-per-milliliter (PPM) for different sized bottles of the same product.
    *   Provides a direct link to the relevant BAXUS listing if a good match is found.

The goal is to save users time searching multiple sites and potentially drive traffic to the BAXUS marketplace when better deals are available there.

## How it Works (Technical Overview)

1.  **User Action:** The user clicks the extension icon on a product page.
2.  **URL Retrieval:** The popup script gets the current tab's URL.
3.  **Background Processing:** The URL is sent to the background service worker.
4.  **Scraping:** The background script sends the URL to the Firecrawl API to get the page content as Markdown.
5.  **AI Extraction:** The Markdown content is sent to the Google Gemini API with a specific prompt to extract the product `name`, `price`, and `volume_ml`.
6.  **BAXUS Data:** The background script calls the BAXUS listings API endpoint to get all currently listed items.
7.  **Matching & Comparison:** A matching algorithm compares the extracted `name` and `volume_ml` with the BAXUS listings. It handles name variations (simple normalization) and volume differences (including PPM comparison).
8.  **Response:** The comparison result (match found/not found, savings, BAXUS link, etc.) is sent back to the popup script.
9.  **Display:** The popup displays the formatted results to the user.

## Setup and Installation

Follow these steps to get the extension running locally for development and testing:

**1. Prerequisites:**

*   You need Google Chrome installed.

**2. Get API Keys:**

This extension requires API keys for two external services:

*   **Firecrawl API Key:**
    *   Go to [firecrawl.dev](https://firecrawl.dev/).
    *   Sign up for an account (they usually have a free tier).
    *   Navigate to your dashboard or API key section and generate/copy your API key. It will likely start with `fc-`.
*   **Google Gemini API Key:**
    *   Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
    *   You will need a Google account.
    *   Create a new API key.
    *   Copy the generated key. Keep it safe! (Note: Google AI services have usage limits and potential costs beyond the free tier).

**3. Add API Keys to the Code (IMPORTANT SECURITY NOTE):**

*   **Current Method (Insecure - Development Only):** For this development version, the API keys need to be **hardcoded directly into the source code**.
    *   Open the file: `utils/api_clients.js`
    *   Find these lines near the top:
        ```javascript
        // --- WARNING: INSECURE - FOR DEVELOPMENT TESTING ONLY ---
        const FIRECRAWL_API_KEY = 'fc-YOUR_ACTUAL_FIRECRAWL_KEY'; // Replace with your real key
        const GEMINI_API_KEY = 'YOUR_ACTUAL_GEMINI_KEY'; // Replace with your real key
        // --- END WARNING ---
        ```
    *   **Replace** the placeholder strings (`'fc-YOUR_ACTUAL_FIRECRAWL_KEY'` and `'YOUR_ACTUAL_GEMINI_KEY'`) with the actual API keys you obtained in Step 2.
*   **🚨 WARNING:** This method of hardcoding keys is **highly insecure** and should **ONLY** be used for your local development and testing.
    *   **DO NOT** commit `utils/api_clients.js` with your real keys to public repositories like GitHub. Add the file path `utils/api_clients.js` to your `.gitignore` file immediately to prevent accidental commits.
    *   **DO NOT** distribute the extension `.crx` package built with hardcoded keys.
    *   A production-ready version should use `chrome.storage` and an options page for users to securely enter their *own* keys.

**4. Load the Extension in Chrome:**

*   Open Google Chrome.
*   Navigate to the extensions page: `chrome://extensions/`
*   Enable **"Developer mode"** using the toggle switch (usually in the top-right corner).
*   Click the **"Load unpacked"** button that appears.
*   In the file dialog that opens, navigate to and select the **entire root folder** of this project (the folder containing `manifest.json`, `popup/`, `background/`, etc.).
*   The "BAXUS Price Checker" extension should now appear in your list of extensions.

## Usage

1.  Navigate to a webpage showing a specific whisky or wine bottle product (e.g., on a site like Total Wine, The Whisky Exchange, Astor Wines, etc.).
2.  Click the **BAXUS Price Checker icon** in your Chrome toolbar (it should look like the icon you placed in the `icons/` folder).
3.  The popup will appear and show "Checking prices...".
4.  Wait a few moments while the extension scrapes the page, queries the APIs, and performs the comparison.
5.  The popup will update to show the comparison results or an error message if something went wrong.
6.  If a relevant BAXUS listing is found, a "View on BAXUS" link will appear.

**Troubleshooting:**

*   If the extension doesn't seem to work or shows an error, you can check the logs:
    *   Go back to `chrome://extensions/`.
    *   Find the "BAXUS Price Checker" card.
    *   Click the **"Service worker"** link to open the background script's console and look for error messages.
    *   You can also right-click the extension *popup* and select "Inspect" to view the popup's console.

## Future Improvements (TODO)

*   **Secure API Key Handling:** Implement an options page for users to enter their own API keys, storing them via `chrome.storage`.
*   **Fuzzy Name Matching:** Integrate a library like `Fuse.js` for more robust matching of bottle names with minor variations.
*   **BAXUS API Pagination:** Handle potential pagination if BAXUS listings exceed the current fetch limit.
*   **Improved Scraping/Extraction:** Explore fallback CSS selectors before relying solely on AI, refine Gemini prompts.
*   **Site-Specific Scrapers:** Add custom logic for popular retail sites that might be difficult to scrape generically.
*   **Caching:** Cache BAXUS results for a short duration to improve speed and reduce API calls.
*   **UI Enhancements:** Improve the visual presentation in the popup.
*   **Error Handling:** Provide more specific and user-friendly error messages.

---

*Disclaimer: This extension relies on third-party APIs (Firecrawl, Google Gemini, BAXUS) which may have associated costs, rate limits, or terms of service. The scraping process may break if website structures change. Use responsibly.*