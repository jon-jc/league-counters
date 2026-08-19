import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-32 text-center sm:px-6">
      <p className="font-display text-7xl font-semibold text-gradient">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold">This page wandered into the fog</h1>
      <p className="mt-2 max-w-md text-sm text-fg-muted">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-canvas"
      >
        Back home
      </Link>
    </div>
  );
}
