// server/middleware/require-auth.ts
import { defineEventHandler } from 'h3';
import { ensureAuthHeaderOnPrivateApi } from '../utils/http';

export default defineEventHandler((event) => {
  ensureAuthHeaderOnPrivateApi(event); // check for Authorization header presence
});
