'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export function PdfPreview({ material, page, onClose }: { material: { id: string; name: string }; page?: number | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController(); let objectUrl = '';
    setUrl(''); setError('');
    api.materials.content(material.id, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [material.id]);
  return <dialog ref={dialog} onCancel={onClose} className="h-[90vh] w-[95vw] max-w-6xl rounded-2xl bg-card p-4 text-ink backdrop:bg-black/50" aria-label={`Preview ${material.name}`}>
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-bold">{material.name}</h2><div className="flex gap-4">{url && <a href={url} download={material.name} className="text-primary">Download</a>}<button onClick={onClose} autoFocus className="font-bold">Close</button></div></div>
    {error ? <p role="alert">{error}</p> : !url ? <p role="status">Loading PDF…</p> : <object data={`${url}#page=${Math.max(1, page || 1)}`} type="application/pdf" className="h-[calc(100%-3rem)] w-full"><p>Your browser cannot preview this PDF. <a href={url} download={material.name}>Download it</a>.</p></object>}
  </dialog>;
}
