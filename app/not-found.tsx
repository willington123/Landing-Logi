import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
      <div className="w-16 h-16 rounded-2xl bg-brand-blue/20 text-brand-blue flex items-center justify-center text-2xl font-black mb-4 border border-brand-blue/30">
        404
      </div>
      <h1 className="text-2xl font-bold mb-2">Página no encontrada</h1>
      <p className="text-sm text-slate-400 max-w-sm mb-6">
        La sección que estás buscando no existe o fue movida.
      </p>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 bg-brand-gradient text-white rounded-xl text-xs font-bold shadow-md hover:opacity-95 transition"
      >
        Volver al Dashboard
      </Link>
    </div>
  );
}
