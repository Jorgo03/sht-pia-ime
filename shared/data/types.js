/**
 * @typedef {Object} Property
 * @property {string} id
 * @property {string} agent_id
 * @property {string} title
 * @property {string|null} description
 * @property {number} price
 * @property {string} address
 * @property {string|null} city
 * @property {number|null} sqft
 * @property {number|null} beds
 * @property {number|null} baths
 * @property {'apartment'|'house'|'land'|'commercial'|null} property_type
 * @property {'sale'|'rent'} listing_type
 * @property {string[]} image_urls
 * @property {'active'|'pending'|'sold'|'draft'} status
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Favorite
 * @property {string} id
 * @property {string} user_id
 * @property {string} property_id
 * @property {string} created_at
 */

/**
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string|null} full_name
 * @property {string|null} avatar_url
 * @property {string|null} phone
 * @property {'buyer'|'agent'} role
 * @property {string|null} agency_name
 * @property {string|null} bio
 * @property {string} created_at
 * @property {string} updated_at
 */

export {}
