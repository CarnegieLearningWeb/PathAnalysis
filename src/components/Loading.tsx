import { Loader2 } from 'lucide-react';

export default function Loading() {
    return (
        // `fixed inset-0` rather than `absolute top-0 left-0 w-full h-full`: the
        // old version had no positioned ancestor, so it only happened to cover
        // the viewport and would break the moment a parent became relative.
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
        >
            <div className="flex items-center gap-2.5 rounded-lg border bg-card px-4 py-3 shadow-lg">
                <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                <p className="text-sm font-medium">Processing data…</p>
            </div>
        </div>
    )
}
