import { Component } from "react";

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-gradient-to-b from-[#f9d6d1] to-white text-gray-900">
                    <p className="text-2xl font-semibold">Something went wrong.</p>
                    <p className="text-neutral-500 text-sm">An unexpected error occurred. Try reloading the page.</p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="rounded-2xl px-5 py-2.5 bg-black text-white text-sm hover:opacity-90 transition"
                        >
                            Reload page
                        </button>
                        <a
                            href="/"
                            className="rounded-2xl px-5 py-2.5 ring-1 ring-black/10 text-sm hover:bg-black/5 transition"
                        >
                            Go home
                        </a>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
