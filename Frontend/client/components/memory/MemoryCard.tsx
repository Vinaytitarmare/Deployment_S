import { cn } from "@/lib/utils";
import { MemoryItem } from "@/types/memory";
import { jsPDF } from "jspdf"; // <-- 1. Import jsPDF
import { ExternalLink } from "lucide-react";
import { useState } from "react";

// Helper components (TypeBadge, EmotionBadge, getImageForType)
// ... (These stay exactly the same as before) ...
function TypeBadge({ type }: { type: MemoryItem["type"] }) {
    const label = type[0].toUpperCase() + type.slice(1);
    return (
        <span className="text-xs font-medium text-muted-foreground">
            {label}
        </span>
    );
}

function EmotionBadge({ emotion }: { emotion?: string }) {
    if (!emotion) return null;
    return (
        <span className="text-xs font-medium text-cyan-400">
            • {emotion}
        </span>
    );
}

function getImageForType(type: MemoryItem["type"]) {
    switch (type) {
        case "youtube":
            return "/images/youtube.png";
        case "linkedin":
            return "/images/linkedin.png";
        case "twitter":
            return "/images/twitter.jpeg";
        case "text":
            return "/images/article.jpeg"; // Using article as fallback for text
        case "reddit":
            return "/images/reddit.png";
        case "quora":
            return "/images/quora.png";
        case "instagram":
            return "/images/instagram.png";
        case "github":
            return "/images/github.png";
        case "article":
        default:
            return "/images/article.jpeg";
    }
}


// Main Component Definition
export default function MemoryCard({
    item,
    onToggleFav,
    onDelete, 
}: {
    item: MemoryItem;
    onToggleFav?: (id: string) => void;
    onDelete?: (id: string) => void; 
}) {
    const imageUrl = getImageForType(item.type);
    const [showOptions, setShowOptions] = useState(false);

    const handleDeleteClick = () => {
        // We will replace window.confirm with a custom modal later
        // For now, this is functional.
        if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
            onDelete?.(item.id);
        }
        setShowOptions(false); // Close dropdown
    };

    // --- 2. Add the PDF Download Handler ---
    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        
        // Set font styles
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(item.title, 10, 20);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);

        // Add Summary with line wrapping
        doc.setFontSize(10);
        doc.text("Summary:", 10, 35);
        const summaryLines = doc.splitTextToSize(item.summary || "No summary available.", 180);
        doc.text(summaryLines, 10, 42);
        
        // Calculate position for next sections
        let currentY = 42 + (summaryLines.length * 5) + 10; // 5mm per line, 10mm padding

        // Add Keywords
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Keywords:", 10, currentY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(item.keywords?.join(', ') || "None", 10, currentY + 7);

        currentY += 17;

        // Add Source URL
        const pdfUrl = item.url || item.original_url;
        if (pdfUrl) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Source:", 10, currentY);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 255); // Blue color for link
            doc.textWithLink(pdfUrl, 10, currentY + 7, { url: pdfUrl });
        }

        // Clean filename: remove invalid characters
        const safeTitle = item.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        doc.save(`${safeTitle}_summary.pdf`);
        setShowOptions(false); // Close dropdown
    };
    

    return (
        <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:border-ring/50 hover:shadow-md">
            
            {/* ... (Top and Middle sections remain the same) ... */}
            <div className="p-6 pb-0">
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs">
                        <TypeBadge type={item.type} />
                        <EmotionBadge emotion={item.emotion} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <img
                            src={imageUrl}
                            alt={`${item.type} icon`}
                            className="h-16 w-16 rounded-lg object-cover"
                            onError={(e) => { e.currentTarget.src = "/images/article.jpeg"; }} // Fallback
                        />
                        {item.favorite && (
                            <span className="text-lg leading-none text-cyan-400">★</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex flex-1 flex-col justify-between p-6 pt-0">
                <div> 
                    <h3 className="mb-3 line-clamp-2 text-lg font-bold leading-tight text-card-foreground">
                        {item.title}
                    </h3>
                    {item.summary && (
                        <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                            {item.summary}
                        </p>
                    )}
                    {item.keywords && item.keywords.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                            {item.keywords.slice(0, 4).map((k) => (
                                <span
                                    key={k}
                                    className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                                >
                                    {k}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bottom section */}
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3 relative">
                    {/* <time className="text-xs text-zinc-500">
    {new Date(item.timestamp).toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false, // 24-hour format
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    })}

</time> */}
 {/* //this gave time later  */}
 <time className="text-xs text-muted-foreground">
    {(() => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${timeStr}, ${dateStr}`;
    })()}
</time>

                    <div className="flex items-center gap-2">
                        {(item.url || item.original_url) && (
                            <a 
                                href={item.url || item.original_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-cyan-400"
                                title="Open Link"
                            >
                                <ExternalLink className="h-4 w-4" />
                                {/* <span className="hidden sm:inline">Visit</span> */}
                            </a>
                        )}
                        <button
                            onClick={() => onToggleFav?.(item.id)}
                            className={cn(
                                "rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:border-cyan-500/50 hover:bg-secondary",
                                item.favorite && "border-cyan-500 text-cyan-400"
                            )}
                        >
                            {item.favorite ? "★ Unfavorite" : "☆ Favorite"}
                        </button>

                        <button
                            onClick={() => setShowOptions(!showOptions)}
                            className="rounded-lg p-1.5 text-xs text-muted-foreground hover:bg-secondary"
                            aria-label="More options"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                        </button>

                        {/* --- 3. UPDATED Options Dropdown --- */}
                        {showOptions && (
                            <div className="absolute right-0 bottom-full mb-1 w-32 rounded-md border border-border bg-popover shadow-lg z-10">
                                <button
                                    onClick={handleDownloadPDF} // <-- Add PDF download
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-cyan-400 hover:bg-secondary"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Download
                                </button>
                                <button
                                    onClick={handleDeleteClick}
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-secondary"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}