import React from 'react';
import { MessageSquare, Trash2, Plus } from 'lucide-react';

export default function SessionList({
    sessions,
    currentSessionId,
    onSessionSwitch,
    onSessionDelete,
    onNewSession,
    onClearAll
}) {
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">Conversations</h3>
                <button
                    onClick={onNewSession}
                    className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors"
                    title="New conversation"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {sessions.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-8">
                        No conversations yet
                    </div>
                ) : (
                    sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => onSessionSwitch(session.id)}
                            className={`group relative p-3 rounded-lg cursor-pointer transition-all ${session.id === currentSessionId
                                    ? 'bg-indigo-50 border border-indigo-200'
                                    : 'bg-white border border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-start gap-2">
                                <MessageSquare className={`w-4 h-4 mt-0.5 shrink-0 ${session.id === currentSessionId ? 'text-indigo-600' : 'text-slate-400'
                                    }`} />
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium truncate ${session.id === currentSessionId ? 'text-indigo-900' : 'text-slate-700'
                                        }`}>
                                        {session.title}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                        {new Date(session.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSessionDelete(session.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-all"
                                    title="Delete conversation"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            {sessions.length > 0 && (
                <div className="p-3 border-t border-slate-200">
                    <button
                        onClick={onClearAll}
                        className="w-full py-2 px-3 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                    >
                        Clear All History
                    </button>
                </div>
            )}
        </div>
    );
}
