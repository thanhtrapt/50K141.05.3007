import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config, assertJwtSecretConfigured } from './config.js';
const scrypt = promisify(crypto.scrypt);

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm,n,r,p,saltText,keyText] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !saltText || !keyText) return false;
  const salt = Buffer.from(saltText,'base64url');
  const expected = Buffer.from(keyText,'base64url');
  const actual = await scrypt(password,salt,expected.length,{N:Number(n),r:Number(r),p:Number(p)});
  return crypto.timingSafeEqual(expected,actual);
}

function durationSeconds(text) {
  const match = /^(\d+)(s|m|h|d)$/.exec(text);
  if (!match) return 8 * 60 * 60;
  return Number(match[1]) * ({ s:1, m:60, h:3600, d:86400 })[match[2]];
}

export function signToken(user) {
  assertJwtSecretConfigured();
  const now = Math.floor(Date.now()/1000);
  const header = Buffer.from(JSON.stringify({ alg:'HS256',typ:'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub:String(user.id),phone:user.phone,role:user.role,iat:now,exp:now+durationSeconds(config.jwtExpiresIn) })).toString('base64url');
  const content = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256',config.jwtSecret).update(content).digest('base64url');
  return `${content}.${signature}`;
}

export function verifyToken(token) {
  assertJwtSecretConfigured();
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const content = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256',config.jwtSecret).update(content).digest();
  let supplied;
  try { supplied = Buffer.from(parts[2],'base64url'); } catch { return null; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected,supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
    if (!payload.sub || !payload.role || payload.exp <= Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}

export function signActionToken(purpose,values,expiresInSeconds=7*24*60*60) {
  const now=Math.floor(Date.now()/1000);
  const payload=Buffer.from(JSON.stringify({purpose,...values,iat:now,exp:now+expiresInSeconds})).toString('base64url');
  const signature=crypto.createHmac('sha256',config.jwtSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyActionToken(token,purpose) {
  const parts=String(token||'').split('.');
  if(parts.length!==2)return null;
  const expected=crypto.createHmac('sha256',config.jwtSecret).update(parts[0]).digest();
  let supplied;try{supplied=Buffer.from(parts[1],'base64url');}catch{return null;}
  if(expected.length!==supplied.length||!crypto.timingSafeEqual(expected,supplied))return null;
  try {
    const payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    if(payload.purpose!==purpose||!payload.exp||payload.exp<=Math.floor(Date.now()/1000))return null;
    return payload;
  } catch { return null; }
}
