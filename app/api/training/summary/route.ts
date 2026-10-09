import { NextRequest } from 'next/server';
import { failure, summary } from '@/src/modules/training/server';
export async function GET(request: NextRequest) { try { return await summary(request); } catch(error) { return failure(error); } }
