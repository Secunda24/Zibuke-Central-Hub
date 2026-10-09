import TrainingPage from '@/src/modules/training/TrainingPage';
export default async function Page({searchParams}:{searchParams:Promise<{userId?:string}>}) {
  const {userId}=await searchParams;
  return <main className="min-h-screen bg-[#0B1120] p-6 sm:p-12"><div className="mx-auto max-w-5xl"><p className="text-sm uppercase tracking-widest text-emerald-400">Learning & development</p><h1 className="mb-8 mt-2 text-3xl font-bold text-white">Training & assessments</h1><TrainingPage initialUserId={typeof userId==='string'?userId:''}/></div></main>;
}
