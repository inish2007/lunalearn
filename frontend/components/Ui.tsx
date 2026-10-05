'use client';
import { useEffect } from 'react';
import { ArrowUpRight, CheckCircle2, ChevronRight, CircleAlert, Clock3, RefreshCw, Sparkles } from 'lucide-react';
export { default as CountUp } from './CountUp';
export function CountUpAll(){ useEffect(()=>{ if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return; const animate=()=>{ const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){const parent=node.parentElement; return parent&&!parent.closest('script,style,textarea,option,[data-count-up]')&&/\d/.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}}); const nodes:Text[]=[]; while(walker.nextNode())nodes.push(walker.currentNode as Text); nodes.forEach(node=>{const original=node.nodeValue||''; const values=Array.from(original.matchAll(/\d[\d,]*/g)); if(!values.length)return; const targets=values.map(match=>Number(match[0].replace(/,/g,''))); const render=(progress:number)=>{let index=0; node.nodeValue=original.replace(/\d[\d,]*/g,match=>{const target=targets[index++]; const value=Math.round(target*(1-Math.pow(1-progress,3))); return match.includes(',')?value.toLocaleString('en-US'):String(value);});}; render(0); const started=performance.now(); const tick=(now:number)=>{const progress=Math.min((now-started)/1000,1); render(progress); if(progress<1)requestAnimationFrame(tick);}; requestAnimationFrame(tick);});}; const frame=requestAnimationFrame(animate); return()=>cancelAnimationFrame(frame);},[]); return null; }
export function PageHeader({eyebrow,title,description,action}:{eyebrow?:string;title:string;description:string;action?:React.ReactNode}) { return <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-primary">{eyebrow || 'LunaLearn workspace'}</p><h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p></div>{action}</div> }
export function Card({children,className=''}:{children:React.ReactNode;className?:string}) { return <section className={`glare-hover rounded-3xl border border-highlight/35 bg-card p-5 shadow-soft ${className}`}>{children}</section> }
export function Progress({value,color='bg-primary'}:{value:number;color?:string}) { return <div className="h-2 overflow-hidden rounded-full bg-highlight/40"><div className={`progress-fill h-full rounded-full ${color}`} style={{width:`${value}%`}}/></div> }
export function Risk({label,detail}:{label:string;detail:string}) { return <div className="flex gap-3 rounded-2xl border border-purple-100 bg-purple-50/70 p-4"><CircleAlert className="mt-0.5 shrink-0 text-primary" size={19}/><div><p className="text-sm font-bold">{label}</p><p className="mt-1 text-xs leading-5 text-muted">{detail}</p></div></div> }
export function TaskRow({title,meta,done=false}:{title:string;meta:string;done?:boolean}) { return <div className="flex items-center gap-3 py-3"><span className={`grid h-6 w-6 place-items-center rounded-full border ${done?'border-primary bg-primary text-white':'border-highlight bg-white'}`}>{done && <CheckCircle2 size={14}/>}</span><div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${done?'text-muted line-through':'text-ink'}`}>{title}</p><p className="mt-0.5 text-xs text-muted">{meta}</p></div><ChevronRight className="text-muted" size={17}/></div> }
export function AcademicDataSkeleton({label='Loading academic data'}:{label?:string}) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="animate-pulse space-y-6">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <div className="h-3 w-36 rounded bg-highlight/60" />
        <div className="h-9 w-64 max-w-full rounded bg-highlight/60" />
        <div className="h-4 w-96 max-w-full rounded bg-highlight/40" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.9fr_.9fr]">
        {[0, 1, 2].map(column => (
          <Card key={column} className="space-y-4 p-5">
            <div className="h-5 w-36 rounded bg-highlight/60" />
            <div className="h-24 rounded-xl bg-highlight/35" />
            <div className="h-4 w-3/4 rounded bg-highlight/45" />
            <div className="h-4 w-1/2 rounded bg-highlight/45" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AcademicDataErrorBanner({
	message,
	actionSuggestion,
	onRetry
}: {
	message: string;
	actionSuggestion?: string;
	onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <CircleAlert className="mt-0.5 shrink-0 text-red-700" size={20} />
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-red-950">Academic data could not be loaded</h2>
          <p className="mt-1 text-sm leading-6 text-red-900">{message}</p>
          {actionSuggestion && <p className="mt-1 text-xs leading-5 text-red-800">{actionSuggestion}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-900 transition hover:bg-red-100 sm:self-center"
      >
        <RefreshCw size={15} /> Retry
      </button>
    </div>
  );
}
export function Mission({compact=false}:{compact?:boolean}) { return <div className={`glare-hover relative overflow-hidden rounded-3xl bg-gradient-to-br from-deep via-primary to-accent p-5 text-white shadow-float ${compact?'':'md:p-7'}`}><div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl"/><div className="relative"><div className="mb-4 flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-white/70"><Sparkles size={15}/> Today&apos;s mission</span><span className="rounded-full bg-white/15 px-3 py-1 text-xs">2h 15m</span></div><h2 className={`${compact?'text-lg':'text-2xl'} font-black`}>Stabilize DBMS readiness</h2><p className="mt-2 max-w-md text-sm leading-6 text-white/80">Revise Normalization, complete your schema assignment, then take a focused 5-question check-in.</p><button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-deep">Start focus session <ArrowUpRight size={16}/></button></div></div> }
export const statMeta = [{label:'Study streak',value:'12 days',icon:Clock3},{label:'Tasks done',value:'18 / 24',icon:CheckCircle2}];
