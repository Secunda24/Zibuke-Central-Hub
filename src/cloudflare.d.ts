import type {Env as WorkerEnv,D1Database as Database,D1PreparedStatement as Statement,R2Bucket as Bucket} from '../cloudflare-env';
declare global {
 type D1Database=Database;
 type D1PreparedStatement=Statement;
 type R2Bucket=Bucket;
 interface CloudflareEnv extends WorkerEnv { RESEND_API_KEY?:string; }
}
