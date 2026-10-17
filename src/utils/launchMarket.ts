import { ALL_COUNTRIES } from '../countries';
/** Current launch is India only. Global country definitions remain available for a later rollout. */
export const LAUNCH_COUNTRIES = ALL_COUNTRIES.filter(country => country.code === 'IN');
export const INDIA_COUNTRY = LAUNCH_COUNTRIES[0];
