import { containsProfanity, filterProfanity, extractProfanityWords } from '../src/utils/profanityFilter.js';

const TEST_CASES = [
  // Clean Cases
  { text: "Hello, how are you today?", expected: false, lang: "en", type: "Clean (EN)" },
  { text: "Let's study for the mathematics exam this evening.", expected: false, lang: "en", type: "Clean (EN)" },
  { text: "The weather is really nice, want to go for a walk?", expected: false, lang: "en", type: "Clean (EN)" },
  { text: "Bonjour, comment ça va aujourd'hui?", expected: false, lang: "fr", type: "Clean (FR)" },
  { text: "Hola, me gustaría reservar una mesa.", expected: false, lang: "es", type: "Clean (ES)" },
  { text: "Kya hum kal mil sakte hain padhai ke liye?", expected: false, lang: "hi", type: "Clean (HI)" },
  
  // Standard English Profanity
  { text: "this is total shit", expected: true, lang: "en", type: "Direct Swear" },
  { text: "shut up you asshole", expected: true, lang: "en", type: "Direct Swear" },
  { text: "he is a bastard", expected: true, lang: "en", type: "Direct Swear" },

  // Leet-speak (English)
  { text: "f*ck this system", expected: true, lang: "en", type: "Leet-speak" },
  { text: "what a sh1t show", expected: true, lang: "en", type: "Leet-speak" },
  
  // Spaced (English)
  { text: "f u c k this", expected: true, lang: "en", type: "Spaced Swear" },
  { text: "s h i t happens", expected: true, lang: "en", type: "Spaced Swear" },

  // Non-English Profanity
  { text: "esta es una puta mierda", expected: true, lang: "es", type: "Spanish Swear" },
  { text: "c'est de la merde", expected: true, lang: "fr", type: "French Swear" },
  { text: "du bist ein arschloch", expected: true, lang: "de", type: "German Swear" },
  { text: "tu bahut bada chutiya hai", expected: true, lang: "hi", type: "Hindi Swear" }
];

const MASK_TEST_CASES = [
  { text: "this is total shit", expected: "this is total s***", lang: "en" },
  { text: "shut up you asshole", expected: "shut up you a******", lang: "en" },
  { text: "esta es una puta mierda", expected: "esta es una p*** m*****", lang: "es" },
  { text: "c'est de la merde", expected: "c'est de la m****", lang: "fr" },
  { text: "tu bahut bada chutiya hai", expected: "tu bahut bada c****** hai", lang: "hi" }
];

const EXTRACTION_TEST_CASES = [
  { text: "this is total shit", expected: ["shit"], lang: "en" },
  { text: "what an asshole and a bastard", expected: ["asshole", "bastard"], lang: "en" },
  { text: "c'est de la merde", expected: ["merde"], lang: "fr" }
];

async function runTests() {
  console.log("==================================================");
  console.log("    WAVETONE PROFANITY FILTER VALIDATION SUITE    ");
  console.log("==================================================");

  let passedAll = true;
  let tp = 0, tn = 0, fp = 0, fn = 0;

  console.log("\n1. Running Classification Tests...");
  console.log("--------------------------------------------------");
  
  const classificationResults = [];
  for (const tc of TEST_CASES) {
    const start = process.hrtime.bigint();
    const result = containsProfanity(tc.text, tc.lang);
    const end = process.hrtime.bigint();
    const durationNs = Number(end - start);
    const passed = result === tc.expected;
    
    if (tc.expected === true) {
      if (result === true) tp++;
      else fn++;
    } else {
      if (result === false) tn++;
      else fp++;
    }

    if (!passed) passedAll = false;

    classificationResults.push({
      Type: tc.type,
      Text: `"${tc.text}"`,
      Language: tc.lang.toUpperCase(),
      Expected: tc.expected ? "FLAGGED" : "CLEAN",
      Actual: result ? "FLAGGED" : "CLEAN",
      Status: passed ? "✔ PASS" : "✘ FAIL",
      Time: `${(durationNs / 1000).toFixed(1)}µs`
    });
  }
  console.table(classificationResults);

  // Compute metrics
  const total = TEST_CASES.length;
  const accuracy = ((tp + tn) / total) * 100;
  const precision = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
  const f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  console.log(`\nClassification Summary:`);
  console.log(`- Total Cases:  ${total}`);
  console.log(`- Accuracy:     ${accuracy.toFixed(1)}%`);
  console.log(`- Precision:    ${precision.toFixed(1)}%`);
  console.log(`- Recall:       ${recall.toFixed(1)}%`);
  console.log(`- F1-Score:     ${(f1Score / 100).toFixed(2)}`);
  console.log(`- Breakdown:    TP: ${tp} | TN: ${tn} | FP: ${fp} | FN: ${fn}`);

  console.log("\n2. Running Masking (filterProfanity) Tests...");
  console.log("--------------------------------------------------");
  const maskingResults = [];
  for (const tc of MASK_TEST_CASES) {
    const result = filterProfanity(tc.text, tc.lang);
    const passed = result === tc.expected;
    if (!passed) passedAll = false;

    maskingResults.push({
      Original: `"${tc.text}"`,
      Expected: `"${tc.expected}"`,
      Actual: `"${result}"`,
      Status: passed ? "✔ PASS" : "✘ FAIL"
    });
  }
  console.table(maskingResults);

  console.log("\n3. Running Word Extraction Tests...");
  console.log("--------------------------------------------------");
  const extractionResults = [];
  for (const tc of EXTRACTION_TEST_CASES) {
    const result = extractProfanityWords(tc.text, tc.lang);
    const passed = JSON.stringify(result.sort()) === JSON.stringify(tc.expected.sort());
    if (!passed) passedAll = false;

    extractionResults.push({
      Text: `"${tc.text}"`,
      Expected: `[${tc.expected.join(', ')}]`,
      Actual: `[${result.join(', ')}]`,
      Status: passed ? "✔ PASS" : "✘ FAIL"
    });
  }
  console.table(extractionResults);

  console.log("\n4. Running Performance Latency Benchmark...");
  console.log("--------------------------------------------------");
  console.log("Executing 1,000 iterations of containsProfanity on random cases...");
  
  const benchmarkRuns = 1000;
  const startBenchmark = process.hrtime.bigint();
  for (let i = 0; i < benchmarkRuns; i++) {
    const tc = TEST_CASES[i % TEST_CASES.length];
    containsProfanity(tc.text, tc.lang);
  }
  const endBenchmark = process.hrtime.bigint();
  const totalDurationNs = Number(endBenchmark - startBenchmark);
  const avgDurationUs = (totalDurationNs / benchmarkRuns) / 1000;

  console.log(`- Total Time for ${benchmarkRuns} runs: ${(totalDurationNs / 1000000).toFixed(2)} ms`);
  console.log(`- Average Latency per string check: ${avgDurationUs.toFixed(2)} µs (${(avgDurationUs / 1000).toFixed(4)} ms)`);

  console.log("\n==================================================");
  if (passedAll) {
    console.log("       ALL TESTS PASSED SUCCESSFULLY! (✔)       ");
  } else {
    console.log("       SOME TESTS FAILED. CHECK TABLE ABOVE. (✘) ");
    process.exit(1);
  }
  console.log("==================================================");
}

runTests().catch(err => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
