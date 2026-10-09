import { NextRequest } from 'next/server';
import { failure, mutate, overview } from '@/src/modules/training/server';
export async function GET(request: NextRequest) { try { return await overview(request); } catch(error) { return failure(error); } }
export async function POST(request: NextRequest) { try { return await mutate(request); } catch(error) { return failure(error); } }
