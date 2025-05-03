// --- Helper Functions ---

/**
 * Normalizes text for comparison (lowercase, remove extra spaces, common punctuation).
 * Consider adding more sophisticated normalization if needed (e.g., removing 'The', 'A').
 */
function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[.,'-]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts and normalizes volume in milliliters (ml) from various string formats.
 */
function normalizeVolume(sizeString) {
    if (!sizeString || typeof sizeString !== 'string') return null;

    const lowerSize = sizeString.toLowerCase().replace(',', ''); // Remove commas

    // Match patterns like 750ml, 75cl, 1l, 1.75l, 50 ml etc.
    const mlMatch = lowerSize.match(/(\d+(\.\d+)?)\s*ml/);
    if (mlMatch && mlMatch[1]) return parseFloat(mlMatch[1]);

    const clMatch = lowerSize.match(/(\d+(\.\d+)?)\s*cl/);
    if (clMatch && clMatch[1]) return parseFloat(clMatch[1]) * 10;

    const literMatch = lowerSize.match(/(\d+(\.\d+)?)\s*l/);
    if (literMatch && literMatch[1]) return parseFloat(literMatch[1]) * 1000;

    // Basic number check if unit is missing (assume ml if common like 750, 700, 375)
     const numberMatch = lowerSize.match(/^(\d+(\.\d+)?)$/);
     if (numberMatch && numberMatch[1]) {
         const num = parseFloat(numberMatch[1]);
         if ([750, 700, 375, 50, 1000, 1750, 500].includes(num)) { // Common bottle sizes
             return num;
         }
     }


    console.warn(`Could not normalize volume: "${sizeString}"`);
    return null; // Could not determine volume
}


// --- Main Matching Logic ---

/**
 * Compares scraped product details with BAXUS listings.
 * @param {object} scrapedDetails - { name: string, price: number|null, volume_ml: number|null }
 * @param {Array} baxusListings - Array of BAXUS listing objects from the API.
 * @returns {object} - Comparison result: { matchFound: boolean, message: string, baxusLink?: string, baxusNftAddress?: string, savings?: number, comparisonClass?: string }
 */
export function compareWithBaxus(scrapedDetails, baxusListings) {
    if (!scrapedDetails || !scrapedDetails.name) {
        return { matchFound: false, message: "Could not extract product name from the page.", comparisonClass: 'not-found' };
    }
    if (!baxusListings || baxusListings.length === 0) {
        return { matchFound: false, message: "Could not fetch BAXUS listings.", comparisonClass: 'not-found' };
    }

    const scrapedNameNorm = normalizeText(scrapedDetails.name);
    const scrapedVolume = scrapedDetails.volume_ml; // Already normalized by Gemini (hopefully)
    const scrapedPrice = scrapedDetails.price;

     console.log(`Matching: Scraped Name='${scrapedNameNorm}', Volume=${scrapedVolume}, Price=${scrapedPrice}`);

    let bestMatch = null;
    let minPricePPM = Infinity; // Price Per Milliliter for best volume-mismatched alternative

    for (const listing of baxusListings) {
        const source = listing._source;
        if (!source || !source.name || source.price == null) continue; // Skip invalid listings

        const baxusNameNorm = normalizeText(source.name);
        const baxusVolume = normalizeVolume(source.attributes?.Size); // Normalize BAXUS volume string
        const baxusPrice = typeof source.price === 'number' ? source.price : parseFloat(source.price);


        // --- Name Matching (Simple substring check for now, could be improved) ---
        // Check if either name contains the other (handles variations like "Ltd Edition")
         if (baxusNameNorm.includes(scrapedNameNorm) || scrapedNameNorm.includes(baxusNameNorm)) {
             console.log(`Potential Name Match: Scraped='${scrapedNameNorm}' vs BAXUS='${baxusNameNorm}' (Volume: ${baxusVolume}, Price: ${baxusPrice})`);

            // --- Volume Matching ---
             if (scrapedVolume && baxusVolume && scrapedVolume === baxusVolume) {
                 // Exact Volume Match Found! Prioritize these.
                 if (!bestMatch || baxusPrice < bestMatch.price) {
                      console.log(`-> Found EXACT volume match. New Best Match (Price: ${baxusPrice})`);
                     bestMatch = {
                         ...source,
                         price: baxusPrice,
                         volume: baxusVolume,
                         matchType: 'exact'
                     };
                 }
             } else if (scrapedPrice && scrapedVolume && baxusPrice && baxusVolume) {
                  // --- Volume Mismatch: Calculate Price Per ML ---
                   const baxusPPM = baxusPrice / baxusVolume;
                   console.log(` -> Volume Mismatch (Scraped: ${scrapedVolume}ml, BAXUS: ${baxusVolume}ml). BAXUS PPM: $${baxusPPM.toFixed(4)}`);

                   // Keep track of the cheapest *alternative size* per ml, but only if we haven't found an exact match yet
                   if (!bestMatch || bestMatch.matchType !== 'exact') {
                       if (baxusPPM < minPricePPM) {
                            console.log(` -> New Best PPM Match (Price: ${baxusPrice}, Volume: ${baxusVolume})`);
                           minPricePPM = baxusPPM;
                           // Store this as a potential fallback match if no exact volume match is found
                           if (!bestMatch || baxusPPM < (bestMatch.price / bestMatch.volume)) {
                                bestMatch = {
                                     ...source,
                                     price: baxusPrice,
                                     volume: baxusVolume,
                                     matchType: 'ppm'
                                 };
                           }
                       }
                   }
             } else {
                 // Cannot compare volume (missing info) but name matches. Consider it a weak match.
                  console.log(` -> Volume Mismatch or Missing Volume Info. Weak name match.`);
                  if (!bestMatch) { // Only take if absolutely no other match found yet
                       bestMatch = {
                            ...source,
                            price: baxusPrice,
                            volume: baxusVolume, // Could be null
                            matchType: 'name_only'
                       }
                  }
             }
        }
    } // End loop through listings


    // --- Construct Response ---
    if (!bestMatch) {
         console.log("Comparison Result: No suitable match found on BAXUS.");
        return {
            matchFound: false,
            message: `Could not find "${scrapedDetails.name}" on BAXUS.`,
            comparisonClass: 'not-found',
            scraped: scrapedDetails
        };
    }

    const baxusUrl = `https://baxus.co/item/${bestMatch.id}`; // Assuming ID is the NFT address/item identifier for the URL

    if (bestMatch.matchType === 'exact') {
         console.log(`Comparison Result: Exact match found - ${bestMatch.name} (${bestMatch.volume}ml) for $${bestMatch.price}`);
        if (scrapedPrice && bestMatch.price < scrapedPrice) {
            const savings = scrapedPrice - bestMatch.price;
            return {
                matchFound: true,
                message: `Found the same bottle (${bestMatch.volume}ml) on BAXUS for $${bestMatch.price.toFixed(2)}. You could save $${savings.toFixed(2)}!`,
                baxusLink: baxusUrl,
                baxusNftAddress: bestMatch.id,
                savings: savings,
                comparisonClass: 'savings',
                scraped: scrapedDetails
            };
        } else if (scrapedPrice) {
            return {
                matchFound: true,
                message: `Found the same bottle (${bestMatch.volume}ml) on BAXUS for $${bestMatch.price.toFixed(2)}. Current site price is $${scrapedPrice.toFixed(2)}.`,
                baxusLink: baxusUrl,
                 baxusNftAddress: bestMatch.id,
                comparisonClass: 'no-savings',
                 scraped: scrapedDetails
            };
        } else {
             // Scraped price unknown
              return {
                matchFound: true,
                message: `Found the same bottle (${bestMatch.volume}ml) on BAXUS for $${bestMatch.price.toFixed(2)}. (Could not determine current site price).`,
                baxusLink: baxusUrl,
                 baxusNftAddress: bestMatch.id,
                 comparisonClass: 'no-savings', // Or a different class?
                 scraped: scrapedDetails
            };
        }
    } else if (bestMatch.matchType === 'ppm') {
         console.log(`Comparison Result: Best match by PPM - ${bestMatch.name} (${bestMatch.volume}ml) for $${bestMatch.price}`);
         const baxusPPM = bestMatch.price / bestMatch.volume;
         if (scrapedPrice && scrapedVolume) {
              const scrapedPPM = scrapedPrice / scrapedVolume;
              if (baxusPPM < scrapedPPM) {
                   const savingPPM = scrapedPPM - baxusPPM;
                    return {
                        matchFound: true,
                        message: `Found a different size (${bestMatch.volume}ml) on BAXUS for $${bestMatch.price.toFixed(2)}. It's cheaper per ml ($${baxusPPM.toFixed(3)}/ml vs $${scrapedPPM.toFixed(3)}/ml on this site)!`,
                        baxusLink: baxusUrl,
                         baxusNftAddress: bestMatch.id,
                        // savings: savingPPM, // Representing savings per ml might be confusing
                        comparisonClass: 'savings',
                        scraped: scrapedDetails
                    };
              } else {
                   return {
                        matchFound: true,
                        message: `Found a different size (${bestMatch.volume}ml) on BAXUS for $${bestMatch.price.toFixed(2)} ($${baxusPPM.toFixed(3)}/ml). Current site price is $${scrapedPPM.toFixed(3)}/ml.`,
                        baxusLink: baxusUrl,
                         baxusNftAddress: bestMatch.id,
                        comparisonClass: 'no-savings',
                        scraped: scrapedDetails
                    };
              }
         } else {
              // Cannot compare PPM
               return {
                    matchFound: true,
                    message: `Found "${bestMatch.name}" (${bestMatch.volume || 'Unknown size'}) on BAXUS for $${bestMatch.price.toFixed(2)}. (Could not compare price per ml).`,
                    baxusLink: baxusUrl,
                     baxusNftAddress: bestMatch.id,
                    comparisonClass: 'no-savings',
                    scraped: scrapedDetails
               };
         }

    } else { // name_only match
         console.log(`Comparison Result: Name only match - ${bestMatch.name} (${bestMatch.volume || 'Unknown size'}) for $${bestMatch.price}`);
         return {
              matchFound: true, // Technically found *something*
              message: `Found "${bestMatch.name}" (${bestMatch.volume || 'Unknown size'}) on BAXUS for $${bestMatch.price.toFixed(2)}. Volume or price info was missing for a full comparison.`,
              baxusLink: baxusUrl,
              baxusNftAddress: bestMatch.id,
              comparisonClass: 'no-savings', // Treat as no confirmed savings
              scraped: scrapedDetails
         };
    }
}