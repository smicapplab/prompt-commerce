import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
  return {
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || ''
  };
};
