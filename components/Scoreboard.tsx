import React, { useState, useMemo } from 'react';
import { Match, Innings, PlayerStats, BallRecord } from '../types';

interface ScoreboardProps {
  match: Match;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ match }) => {
  const [activeTab, setActiveTab] = useState<number>(match.currentInnings === 2 ? 1 : 0);
  const [expanded, setExpanded] = useState({ batting: true, bowling: true, meta: false });

  const formatDismissal = (p: PlayerStats) => {
    if (!p.out) return 'not out';
    const type = p.dismissal || 'out';
    if (type === 'Caught') return `c ${p.fielder} b ${p.bowler}`;
    if (type === 'Bowled') return `b ${p.bowler}`;
    if (type === 'LBW') return `lbw b ${p.bowler}`;
    if (type === 'Run Out') return `run out (${p.fielder})`;
    if (type === 'Stumped') return `st ${p.fielder} b ${p.bowler}`;
    return `${type} b ${p.bowler}`;
  };

  const calculateFOW = (ballByBall: BallRecord[]) => {
    let runs = 0;
    let wickets = 0;
    let fow: { wicket: number, runs: number, batter: string, over: string }[] = [];
    
    ballByBall.forEach((b, i) => {
      if (b.manualStrikeRotate) return;
      const ballRuns = b.runs + (b.isExtra && (b.extraType === 'wide' || b.extraType === 'noball') ? 1 : 0);
      runs += ballRuns;
      
      if (b.isWicket) {
        wickets++;
        const over = `${Math.floor(i / 6)}.${(i % 6) + 1}`;
        fow.push({ wicket: wickets, runs, batter: b.striker, over });
      }
    });
    return fow;
  };

  const renderTable = (innIdx: number) => {
    const inn = match.innings[innIdx];
    if (!inn) return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-700 py-12 px-6 bg-black/10 rounded-3xl border border-dashed border-white/5 m-4">
        <span className="text-4xl mb-4 grayscale opacity-30">🏏</span>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-center text-slate-500">Waiting for Innings Start</p>
      </div>
    );

    const fow = calculateFOW(inn.ballByBall);
    const extrasBreakdown = {
      wd: inn.ballByBall.filter(b => b.extraType === 'wide').length,
      nb: inn.ballByBall.filter(b => b.extraType === 'noball').length,
      lb: inn.ballByBall.reduce((acc, b) => acc + (b.extraType === 'legbye' ? b.runs : 0), 0),
      by: inn.ballByBall.reduce((acc, b) => acc + (b.extraType === 'bye' ? b.runs : 0), 0),
    };

    const SectionHeader = ({ title, sub, isOpen, onToggle, summary }: any) => (
      <button 
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-5 py-4 border-b border-white/5 transition-all ${isOpen ? 'bg-white/[0.03]' : 'bg-transparent'}`}
      >
        <div className="flex flex-col items-start">
          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-0.5">{title}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bebas tracking-widest text-white uppercase">{sub}</span>
            {!isOpen && summary && <span className="text-[10px] font-bebas text-emerald-400/60 tracking-widest">{summary}</span>}
          </div>
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
    );

    return (
      <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar scroll-smooth h-full">
        {/* Batting Section */}
        <div className="border-b border-white/5">
          <SectionHeader 
            title="BATTING" 
            sub={inn.battingTeam} 
            summary={`${inn.runs}/${inn.wickets}`}
            isOpen={expanded.batting} 
            onToggle={() => setExpanded(e => ({ ...e, batting: !e.batting }))}
          />
          {expanded.batting && (
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed min-w-[320px]">
                <thead className="bg-black/20">
                  <tr className="border-b border-white/5">
                    <th className="pl-5 py-2 text-[7px] font-black text-slate-500 uppercase w-[40%]">Batter</th>
                    <th className="py-2 text-right text-[7px] font-black text-slate-500 uppercase w-[12%]">R</th>
                    <th className="py-2 text-right text-[7px] font-black text-slate-500 uppercase w-[12%]">B</th>
                    <th className="py-2 text-right text-[7px] font-black text-slate-500 uppercase w-[12%]">4s/6s</th>
                    <th className="pr-5 py-2 text-right text-[7px] font-black text-slate-500 uppercase w-[24%]">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inn.batsmen.map((p, i) => {
                    const isActive = inn.currentBatsmenNames.includes(p.name);
                    const sr = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={i} className={`${isActive ? 'bg-emerald-500/[0.03]' : ''}`}>
                        <td className="pl-5 py-3">
                          <p className={`text-[11px] font-bold truncate ${p.out ? 'text-slate-600' : 'text-slate-200'}`}>
                            {p.name}{isActive ? '*' : ''}
                          </p>
                          <p className="text-[7px] text-slate-500 uppercase tracking-tighter mt-0.5 italic">{formatDismissal(p)}</p>
                        </td>
                        <td className="py-3 text-right font-bebas text-lg text-emerald-400">{p.runs}</td>
                        <td className="py-3 text-right text-[10px] font-bold text-slate-500">{p.balls}</td>
                        <td className="py-3 text-right text-[9px] font-bold text-slate-600">{p.fours}/{p.sixes}</td>
                        <td className="pr-5 py-3 text-right text-[10px] font-bebas text-white/40">{sr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bowling Section */}
        <div className="border-b border-white/5">
          <SectionHeader 
            title="BOWLING" 
            sub={inn.bowlingTeam} 
            isOpen={expanded.bowling} 
            onToggle={() => setExpanded(e => ({ ...e, bowling: !e.bowling }))}
          />
          {expanded.bowling && (
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed min-w-[320px]">
                <thead className="bg-black/20">
                  <tr className="border-b border-white/5">
                    <th className="pl-5 py-2 text-[7px] font-black text-slate-500 uppercase w-[40%]">Bowler</th>
                    <th className="py-2 text-right text-[7px] font-black text-slate-500 uppercase w-[12%]">O</th>
                    <th className="py-2 text-right text-[7px] font-black text-slate-500 uppercase w-[12%]">R</th>
                    <th className="py-2 text-right text-[7px] font-black text-slate-500 uppercase w-[12%]">W</th>
                    <th className="pr-5 py-2 text-right text-[7px] font-black text-slate-500 uppercase w-[24%]">ECON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inn.bowlers.map((p, i) => {
                    const isActive = inn.currentBowlerName === p.name;
                    const totalBalls = (p.overs * 6) + p.balls;
                    const econ = totalBalls > 0 ? ((p.runs / totalBalls) * 6).toFixed(2) : '0.00';
                    return (
                      <tr key={i} className={`${isActive ? 'bg-emerald-500/[0.03]' : ''}`}>
                        <td className="pl-5 py-4">
                          <span className={`text-[11px] font-bold truncate ${isActive ? 'text-emerald-400' : 'text-slate-300'}`}>{p.name}</span>
                        </td>
                        <td className="py-4 text-right text-[10px] font-bold text-slate-500">{p.overs}.{p.balls % 6}</td>
                        <td className="py-4 text-right font-bebas text-lg text-emerald-400">{p.runs}</td>
                        <td className="py-4 text-right font-bebas text-xl text-white">{p.wickets}</td>
                        <td className="pr-5 py-4 text-right text-[10px] font-bebas text-white/40">{econ}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Extras & FOW Section */}
        <div>
          <SectionHeader 
            title="MATCH META" 
            sub="EXTRAS & FOW" 
            isOpen={expanded.meta} 
            onToggle={() => setExpanded(e => ({ ...e, meta: !e.meta }))}
          />
          {expanded.meta && (
            <div className="p-5 space-y-6 bg-black/10">
              {/* Extras */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Extras Breakdown</h5>
                  <span className="text-sm font-bebas text-emerald-400">{inn.extras} RUNS</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'WD', val: extrasBreakdown.wd },
                    { label: 'NB', val: extrasBreakdown.nb },
                    { label: 'LB', val: extrasBreakdown.lb },
                    { label: 'BY', val: extrasBreakdown.by }
                  ].map(x => (
                    <div key={x.label} className="bg-white/5 rounded-xl p-2 text-center border border-white/5">
                      <p className="text-[7px] font-bold text-slate-500 mb-0.5">{x.label}</p>
                      <p className="text-xs font-bebas text-white">{x.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* FOW */}
              <div className="space-y-3">
                <h5 className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Fall of Wickets</h5>
                <div className="space-y-1.5">
                  {fow.length === 0 ? (
                    <p className="text-[9px] text-slate-700 italic">No wickets fallen yet.</p>
                  ) : fow.map((f, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                       <div className="flex items-center gap-3">
                          <span className="text-xs font-bebas text-red-500/60">{f.wicket}-{f.runs}</span>
                          <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">{f.batter}</span>
                       </div>
                       <span className="text-[8px] font-bold text-slate-600 uppercase">Ov {f.over}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="h-12 shrink-0"></div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/60 rounded-[2rem] border border-white/10 flex flex-col h-full overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Header Stat Ring */}
      <div className="px-6 py-5 bg-gradient-to-br from-emerald-950/40 to-black/60 border-b border-white/5 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-3xl font-bebas text-white tracking-widest leading-none">
            {match.innings[activeTab]?.runs || 0}-{match.innings[activeTab]?.wickets || 0}
          </h2>
          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-1.5">
            {match.innings[activeTab]?.battingTeam || 'TBA'} INNINGS
          </p>
        </div>
        <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
          <button 
            onClick={() => setActiveTab(0)}
            className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === 0 ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {match.team1.slice(0, 3)}
          </button>
          <button 
            onClick={() => setActiveTab(1)}
            className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === 1 ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {match.team2.slice(0, 3)}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {renderTable(activeTab)}
      </div>
    </div>
  );
};

export default Scoreboard;
