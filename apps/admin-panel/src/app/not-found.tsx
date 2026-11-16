import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5 text-center">
      <i className="fa-solid fa-truck-fast text-3xl text-naranja" />
      <h1 className="text-xl font-extrabold">No encontramos esta página</h1>
      <Link href="/panel" className="btn-secundario mt-2">Volver al panel</Link>
    </div>
  );
}
