



const FIRECRAWL_API_KEY = ''; // Replace!
const GEMINI_API_KEY = ''; // Replace!


// --- Firecrawl API Client ---
export async function scrapeUrlWithFirecrawl(url) {
    console.log(`Firecrawl: Scraping URL: ${url}`);
    if (!FIRECRAWL_API_KEY || FIRECRAWL_API_KEY.includes('YOUR_FIRECRAWL_API_KEY')) {
        throw new Error("Firecrawl API Key not configured.");
    }
    const firecrawlApiUrl = 'https://api.firecrawl.dev/v0/scrape'; // Ensure this is the correct endpoint

    try {
        const response = await fetch(firecrawlApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
            },
            body: JSON.stringify({
                url: url,
                pageOptions: { // Request markdown format
                    formats: ['markdown']
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown Firecrawl error' }));
            console.error("Firecrawl API Error Response:", errorData);
            throw new Error(`Firecrawl API request failed: ${response.status} ${response.statusText} - ${errorData.error || JSON.stringify(errorData)}`);
        }

        const result = await response.json();
        console.log("Firecrawl Result:", result);

        // Adjust based on the actual Firecrawl response structure V0
        if (result.data && result.data.markdown) {
             return result.data.markdown;
        } else if (result.markdown) { // Check older structure just in case
            return result.markdown;
        } else {
            console.error("Firecrawl: Markdown data not found in response:", result);
             throw new Error("Markdown content not found in Firecrawl response.");
        }

    } catch (error) {
        console.error("Firecrawl Fetch Error:", error);
        throw new Error(`Failed to fetch from Firecrawl: ${error.message}`);
    }
}

// --- Gemini API Client ---
export async function extractProductDetailsWithGemini(markdownContent) {
    console.log("Gemini: Extracting details...");
     if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_GEMINI_API_KEY')) {
        throw new Error("Gemini API Key not configured.");
    }
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`; // Use latest flash model for speed/cost

    // Carefully crafted prompt
    const prompt = `
    Analyze the following markdown content scraped from an e-commerce product page for a whisky or wine bottle. Extract ONLY the following information:
    1.  **name**: The full name of the bottle (e.g., "Lagavulin 16 Year Old Single Malt Scotch Whisky").
    2.  **price**: The numerical price of the bottle. Exclude currency symbols or commas. If multiple prices are present (e.g., sale price), use the lowest available price. If no price is found, return null.
    3.  **volume_ml**: The volume of the bottle converted strictly to milliliters (ml). Examples: "750ml" -> 750, "70cl" -> 700, "1L" -> 1000, "50ml" -> 50. If no volume is found, return null.

    Format the output ONLY as a JSON object with keys "name", "price", and "volume_ml". Do not include any other text, explanations, or markdown formatting.

    Example Input (shortened):
    # Ardbeg Uigeadail Islay Single Malt Scotch Whisky
    Price: $89.99
    Size: 750ml
    Description: A complex mix of peat smoke...

    Example Output:
    {
      "name": "Ardbeg Uigeadail Islay Single Malt Scotch Whisky",
      "price": 89.99,
      "volume_ml": 750
    }

    If you cannot reliably extract a field, return null for that field's value.

    Markdown Content:
    \`\`\`markdown
    ${markdownContent.substring(0, 15000)}
    \`\`\`
    `; // Limit input token size for safety/cost

    try {
        const response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                // Optional: Add safety settings if needed
                // safetySettings: [
                //   { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                //   // Add other categories as needed
                // ],
                generationConfig: {
                    // Ensure JSON output - Note: This might not be fully supported directly
                    // responseMimeType: "application/json", // Check Gemini API docs for exact support
                    temperature: 0.2, // Lower temperature for more deterministic extraction
                    maxOutputTokens: 200
                }
            })
        });

        if (!response.ok) {
             const errorBody = await response.text();
             console.error("Gemini API Error Response:", errorBody);
            throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log("Gemini Raw Result:", JSON.stringify(result, null, 2));


        // Navigate the Gemini response structure
        if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
            let textResult = result.candidates[0].content.parts[0].text;

            // Clean potential markdown code block fences
            textResult = textResult.trim().replace(/^```json\s*|```$/g, '').trim();

            console.log("Gemini Cleaned Text:", textResult);

            try {
                 const extractedData = JSON.parse(textResult);
                 // Validate expected fields
                 if (typeof extractedData.name === 'string' &&
                     (typeof extractedData.price === 'number' || extractedData.price === null) &&
                     (typeof extractedData.volume_ml === 'number' || extractedData.volume_ml === null))
                 {
                     console.log("Gemini Parsed Data:", extractedData);
                     return extractedData;
                 } else {
                      console.error("Gemini Result: Parsed JSON missing expected fields or has wrong types.", extractedData);
                      throw new Error("Gemini returned JSON in an unexpected format.");
                 }
            } catch (parseError) {
                console.error("Gemini Result: Failed to parse JSON:", parseError, "Raw text:", textResult);
                throw new Error(`Gemini returned non-JSON or invalid JSON output. ${parseError.message}`);
            }
        } else if (result.promptFeedback && result.promptFeedback.blockReason) {
             console.error("Gemini Prompt Blocked:", result.promptFeedback);
             throw new Error(`Gemini request blocked: ${result.promptFeedback.blockReason}`);
        }
         else {
            console.error("Gemini Result: Unexpected response structure:", result);
            throw new Error("Could not find extracted text in Gemini response.");
        }

    } catch (error) {
        console.error("Gemini Fetch/Parse Error:", error);
        throw new Error(`Failed to process Gemini request: ${error.message}`);
    }
}


// --- BAXUS API Client ---
export async function fetchBaxusListings() {
    console.log("BAXUS: Fetching listings...");

    const baxusApiUrl = `https://services.baxus.co/api/search/listings?from=0&size=20&listed=true`; // Increase size significantly

    try {
        const response = await fetch(baxusApiUrl);

        if (!response.ok) {
            throw new Error(`BAXUS API request failed: ${response.status} ${response.statusText}`);
        }

        const listings = await response.json();
        console.log(`BAXUS: Fetched ${listings?.length || 0} listings.`);
        // Assuming the response is directly the array as shown in the example
        return listings || [];
    } catch (error) {
        console.error("BAXUS Fetch Error:", error);
        throw new Error(`Failed to fetch BAXUS listings: ${error.message}`);
    }
}