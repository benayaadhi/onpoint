import React from 'react';
import { Trophy, Target, Users, Calendar, ArrowRight, Zap, Shield, Clock } from 'lucide-react';

interface HomepageProps {
    onGetStarted: () => void;
}

export default function Homepage({ onGetStarted }: HomepageProps) {
    return (
        // Changed: Darker base background color
        <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] overflow-hidden font-mono">
            {/* Changed: Animated background elements with new brand colors */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#8B7355]/20 to-[#B45330]/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-[#B45330]/20 to-[#8B7355]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-gradient-to-r from-[#8B7355]/10 to-[#B45330]/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
            </div>

            {/* Header */}
            <header className="relative z-10 px-6 py-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Changed: Icon color and background */}
                        <div className="w-10 h-10 bg-[#FFFFFF] rounded-lg flex items-center justify-center border border-[#F0EBE3]">
                            <Target className="w-6 h-6 text-[#B45330]" />
                        </div>
                        {/* Changed: Text gradient to neon green */}
                        <span className="text-2xl font-bold bg-gradient-to-r from-[#B45330] to-[#C96A40] bg-clip-text text-transparent">
                            On Point
                        </span>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <nav className="flex items-center gap-6">
                            {/* Changed: Hover color for nav links */}
                            <a href="#features" className="text-gray-600 hover:text-[#B45330] transition-colors">Features</a>
                            <a href="#about" className="text-gray-600 hover:text-[#B45330] transition-colors">About</a>
                            <a href="#contact" className="text-gray-600 hover:text-[#B45330] transition-colors">Contact</a>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="relative z-10 px-6 py-20">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-8">
                            {/* Changed: Pill with accent color */}
                            <div className="inline-flex items-center gap-2 bg-[#FFFFFF] border border-[#B45330]/50 rounded-full px-4 py-2 text-sm">
                                <Zap className="w-4 h-4 text-[#B45330]" />
                                <span className="text-gray-600">Padel Tournament Specialist</span>
                            </div>

                            <div className="space-y-6">
                                <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                                    Your padel{' '}
                                    {/* Changed: Headline gradient to neon green */}
                                    <span className="bg-gradient-to-r from-[#B45330] to-[#C96A40] bg-clip-text text-transparent">
                                        scoreboard
                                    </span>
                                </h1>

                                <p className="text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-2xl">
                                    Experience the future of padel tournaments with a professional scoreboard system that
                                    understands the game, tracks every point, and delivers real-time updates to make
                                    your tournaments seamless.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Changed: Primary button style */}
                                <button
                                    onClick={onGetStarted}
                                    className="group bg-[#B45330] text-white border border-[#B45330] px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:bg-[#C96A40] hover:shadow-neon-green flex items-center justify-center gap-3"
                                >
                                    View Tournaments
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>

                                {/* Changed: Secondary button style */}
                                <button className="border border-[#8B7355] text-[#8B7355] px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:bg-[#8B7355]/10 hover:border-[#8B7355]">
                                    Create Tournament
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-4 pt-4">
                                {/* Changed: Feature pill dots to accent color */}
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <div className="w-2 h-2 bg-[#B45330] rounded-full"></div>
                                    Available 24/7
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <div className="w-2 h-2 bg-[#B45330] rounded-full"></div>
                                    No setup required
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <div className="w-2 h-2 bg-[#B45330] rounded-full"></div>
                                    Tournament ready
                                </div>
                            </div>
                        </div>

                        {/* !! MAJOR CHANGE: Visual Element updated to match SpectatorView !! */}
                        <div className="relative">
                            <div className="relative w-full max-w-lg mx-auto">
                                <div className="absolute inset-0 bg-gradient-to-r from-[#8B7355] via-[#B45330] to-[#8B7355] rounded-full blur-3xl opacity-20 animate-pulse"></div>

                                <div className="relative bg-[#FFFFFF] border border-[#8B7355] rounded-2xl shadow-2xl overflow-hidden">
                                    <div className="grid grid-cols-5 bg-[#F0EBE3] text-center py-3">
                                        <div className="text-sm font-bold text-gray-400"></div>
                                        <div className="text-sm font-bold text-[#B45330]">SET 1</div>
                                        <div className="text-sm font-bold text-[#B45330]">SET 2</div>
                                        <div className="text-sm font-bold text-[#B45330]">SET 3</div>
                                        <div className="text-sm font-bold bg-[#B45330] text-[#FAF8F5] rounded-tr-lg">GAME</div>
                                    </div>
                                    <div className="grid grid-cols-5 border-b border-[#F0EBE3]">
                                        <div className="p-4 flex items-center gap-3">
                                            <div className="w-4 h-4 bg-[#B45330] rounded-full animate-pulse"></div>
                                            <div className="font-bold text-[#2A2A2A]">Team 1</div>
                                        </div>
                                        <div className="p-4 text-center text-3xl font-bold flex items-center justify-center">6</div>
                                        <div className="p-4 text-center text-3xl font-bold flex items-center justify-center">4</div>
                                        <div className="p-4 text-center text-3xl font-bold flex items-center justify-center">2</div>
                                        <div className="p-4 text-center bg-[#B45330] text-[#FAF8F5] text-4xl font-bold flex items-center justify-center">40</div>
                                    </div>
                                    <div className="grid grid-cols-5">
                                        <div className="p-4 flex items-center gap-3">
                                            <div className="font-bold text-[#2A2A2A]">Team 2</div>
                                        </div>
                                        <div className="p-4 text-center text-3xl font-bold flex items-center justify-center">4</div>
                                        <div className="p-4 text-center text-3xl font-bold flex items-center justify-center">6</div>
                                        <div className="p-4 text-center text-3xl font-bold flex items-center justify-center">3</div>
                                        <div className="p-4 text-center bg-[#B45330] text-[#FAF8F5] text-4xl font-bold flex items-center justify-center">AD</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Features Section */}
            <section id="features" className="relative z-10 px-6 py-20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                            Built for{' '}
                            {/* Changed: Headline gradient to neon green */}
                            <span className="bg-gradient-to-r from-[#B45330] to-[#C96A40] bg-clip-text text-transparent">
                                padel professionals
                            </span>
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            Every feature designed specifically for padel tournaments, from official scoring rules to real-time spectator views.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { icon: Trophy, title: 'Official Padel Scoring' },
                            { icon: Users, title: 'Multiple Tournament Formats' },
                            { icon: Calendar, title: 'Smart Court Management' },
                            { icon: Target, title: 'Real-Time Updates' },
                            { icon: Shield, title: 'Spectator Views' },
                            { icon: Clock, title: 'Match History & Analytics' }
                        ].map((feature, index) => (
                            <div
                                key={index}
                                // Changed: Card styling and hover effects
                                className="group bg-[#FFFFFF]/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 hover:border-[#B45330]/50 transition-all duration-300 hover:transform hover:-translate-y-2"
                            >
                                {/* Changed: Icon styling */}
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-[#F0EBE3] rounded-xl mb-4 group-hover:scale-110 transition-transform">
                                    <feature.icon className="w-6 h-6 text-[#B45330]" />
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-[#2A2A2A]">{feature.title}</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    {/* Descriptions can be re-added here if needed */}
                                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 px-6 py-8 border-t border-[#F0EBE3]">
                <div className="max-w-7xl mx-auto text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-gradient-to-r from-[#B45330] to-[#C96A40] rounded-lg flex items-center justify-center">
                            <Target className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-[#B45330] to-[#C96A40] bg-clip-text text-transparent">
                            On Point
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm">
                        Professional padel tournament scoreboard and live viewing system
                    </p>
                    <p className="text-gray-600 text-xs mt-2">
                        © 2025 On Point. Built for padel enthusiasts worldwide.
                    </p>
                </div>
            </footer>
        </div>
    );
}