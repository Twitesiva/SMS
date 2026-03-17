/**
 * Section naming utilities
 * Generates A1, A2, A3... pattern
 */

 /**
  * Generate section names A1 to AN
  * @param {number} count - Number of sections to generate
  * @returns {string[]} Array of section names ["A1", "A2", ...]
  */
 export const generateSectionNames = (count) => {
   if (!Number.isInteger(count) || count < 1 || count > 20) {
     throw new Error('Count must be integer between 1-20');
   }
   return Array.from({ length: count }, (_, i) => `A${i + 1}`);
 };

 /**
  * Validate section name pattern
  * @param {string} name 
  * @returns {boolean}
  */
 export const isValidSectionName = (name) => {
   return /^A\d+$/.test(name.toUpperCase());
 };

 /**
  * Get numeric part from section name
  * @param {string} name 
  * @returns {number|null}
  */
 export const getSectionNumber = (name) => {
   const match = name.toUpperCase().match(/^A(\d+)$/);
   return match ? parseInt(match[1], 10) : null;
 };

