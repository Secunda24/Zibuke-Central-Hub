import {NextRequest} from 'next/server';
import {reconcileRequest} from '@/src/modules/training/reconciliation';
import {failure} from '@/src/modules/training/server';
export async function POST(request:NextRequest) {try{return await reconcileRequest(request);}catch(error){return failure(error);}}
