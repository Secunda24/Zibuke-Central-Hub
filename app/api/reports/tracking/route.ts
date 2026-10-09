import { NextRequest } from 'next/server';
import { failure, mutate, overview } from '@/src/modules/training/server';
export async function GET(request: NextRequest) { try { return await overview(request); } catch(error) { return failure(error); } }
export async function POST(request: NextRequest) {
  try {
    const body=await request.clone().json();
    if(body.action!=='submit_report') return new Response('Only report submissions are accepted here',{status:400});
    return await mutate(request);
  } catch(error) { return failure(error); }
}
