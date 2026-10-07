'use client';
export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}) {
 return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">This page could not load</h1><p className="my-4">Your saved work is still available. Please try again.</p><button className="rounded-xl bg-primary px-4 py-2 text-white" onClick={reset}>Try again</button><a className="ml-4 underline" href="/dashboard">Dashboard</a></main>;
}
