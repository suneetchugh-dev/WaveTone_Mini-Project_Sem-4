import * as toxicity from '@tensorflow-models/toxicity';
// Use pure JS TensorFlow.js to avoid native C++ binding issues on newer Node versions
import '@tensorflow/tfjs';
import { containsProfanity } from './profanityFilter.js';

// The minimum prediction confidence
const threshold = 0.8;
let model = null;

// Load the model
toxicity.load(threshold).then(mod => {
  model = mod;
  console.log('TensorFlow Toxicity model loaded.');
}).catch(err => {
  console.error('Failed to load TensorFlow Toxicity model:', err);
});

/**
 * Checks if the text contains profanity or is highly toxic.
 * @param {string} text - The transcribed text to check
 * @returns {Promise<boolean>} true if profane/toxic, false otherwise
 */
export async function isToxicOrProfane(text) {
  if (!text || text.trim().length === 0) return false;
  
  // 1. Fast path: check against our existing profanity word list
  if (containsProfanity(text)) {
    return true;
  }
  
  // 2. Deep check: Use TensorFlow Toxicity model
  if (!model) {
    console.warn('Toxicity model not fully loaded yet, falling back to basic profanity filter only.');
    return false;
  }

  try {
    const predictions = await model.classify([text]);
    
    // predictions is an array of objects like { label: 'insult', results: [{ match: false, probabilities: [...] }] }
    for (const prediction of predictions) {
      // We flag if any of the labels match (except maybe benign ones, but toxicity model labels are generally all bad)
      // Labels: identity_attack, insult, obscene, severe_toxicity, sexual_explicit, threat, toxicity
      if (prediction.results[0].match === true) {
        console.log(`Text flagged as ${prediction.label}: "${text}"`);
        return true;
      }
    }
  } catch (err) {
    console.error('Error classifying text:', err);
  }

  return false;
}
