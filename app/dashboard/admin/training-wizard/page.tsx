import TrainingWizard from '@/src/modules/training/TrainingWizard';

export default function TrainingWizardPage() {
  return (
    <main className="min-h-screen bg-[#0B1120] p-6 text-white sm:p-12">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00DF73]">System administration</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Training Publisher Wizard</h1>
        <p className="mt-2 text-gray-400">
          Build a course, add its curriculum and quiz, and publish it to a department, the interns, or a learning position — all in one step.
        </p>
        <div className="mt-8">
          <TrainingWizard />
        </div>
      </div>
    </main>
  );
}
