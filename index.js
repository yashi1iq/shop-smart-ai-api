import { config } from '../config.js';
import { amazon } from './amazon.js';
import { flipkart } from './flipkart.js';

/* Add a store by creating a module with { id, name, searchUrl(q), flags(), waitFor, parse(html, {limit}) }
   and registering it here. Then add its id to the STORES env var. */
export const REGISTRY = { amazon, flipkart };

export const enabledStores = () => config.stores.map((id) => REGISTRY[id]).filter(Boolean);
