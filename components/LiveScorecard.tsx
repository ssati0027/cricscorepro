
import React, { useState, useMemo } from 'react';
import { Match, BallRecord, Innings } from '../types';

interface LiveScorecardProps {
  match: Match;
  onToggleScoreboard: () => void;
}

const LiveScorecard: React.FC<LiveScorecardProps> = ({ match, onToggleScoreboard }) => {
  const [showFullHistory, setShowFullHistory] = useState(false);
  const innIdx = (match.currentInnings || 1) - 1;
  const innings = match.innings[innIdx];
  if (!innings) return null;

  const getBallLabel = (b: BallRecord) => {
    if (b.isWicket) return 'W';
    if (b.isExtra) {
      const map: Record<string, string> = { wide: 'Wd', noball: 'Nb', bye: 'By', legbye: 'Lb' };
      return `${b.runs}${map[b.extraType!] || 'E'}`;
    }
    return b.runs.toString();
  };

  const getWinnerMessage = (m: Match) => {
    const inn1 = m.innings[0]!;
    const inn2 = m.innings[1];
    if (!inn2) return "Innings Break";
    if (inn2.runs > inn1.runs) return `${inn2.battingTeam} WON BY ${10 - inn2.wickets} WICKETS`;
    if (m.status === 'completed') {
      if (inn1.runs > inn2.runs) return `${inn1.battingTeam} WON BY ${inn1.runs - inn2.runs} RUNS`;
      return "MATCH TIED";
    }
    return "";
  };

  const overs = Math.floor(innings.balls / 6);
  const balls = innings.balls % 6;
  const rr = innings.balls > 0 ? (innings.runs / (innings.balls / 6)).toFixed(2) : "0.00";

  const isSecondInnings = match.currentInnings === 2;
  const target = isSecondInnings ? (match.innings[0]?.runs ?? 0) + 1 : null;
  const runsNeeded = target !== null ? Math.max(0, target - innings.runs) : null;
  const ballsRemaining = isSecondInnings ? Math.max(0, (match.totalOvers * 6) - innings.balls) : null;
  const rrr = (runsNeeded !== null && ballsRemaining !== null && ballsRemaining > 0) 
    ? ((runsNeeded / (ballsRemaining / 6))).toFixed(2) 
    : "0.00";

  const batter1 = innings.batsmen.find(b => b.name === innings.currentBatsmenNames[0]);
  const batter2 = innings.batsmen.find(b => b.name === innings.currentBatsmenNames[1]);
  const bowler = innings.bowlers.find(b => b.name === innings.currentBowlerName);

  const currentOverBalls = innings.currentOverBalls.filter(b => !b.manualStrikeRotate);

  // Group all balls into overs for the full history view
  const groupedOvers = useMemo(() => {
    const groups: BallRecord[][] = [];
    let currentGroup: BallRecord[] = [];
    let legalCount = 0;

    innings.ballByBall.forEach(b => {
      if (b.manualStrikeRotate) return;
      currentGroup.push(b);
      const isExtraThatRepeats = b.isExtra && (b.extraType === 'wide' || b.extraType === 'noball');
      if (!isExtraThatRepeats) {
        legalCount++;
      }
      if (legalCount === 6) {
        groups.push([...currentGroup]);
        currentGroup = [];
        legalCount = 0;
      }
    });
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    return groups;
  }, [innings.ballByBall]);

  return (
    <>
      <div className="bg-gradient-to-br from-emerald-900/60 to-black/80 rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden backdrop-blur-md relative">
        {/* Top Banner */}
        <div className="px-5 py-4 flex justify-between items-center border-b border-white/5 bg-white/5">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="text-3xl font-bebas text-white leading-none">{innings.runs}/{innings.wickets}</span>
               <span className="text-xs font-bebas text-emerald-400 mt-1">({overs}.{balls} OV)</span>
            </div>
            <div className="flex flex-col">
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">{innings.battingTeam} Batting • CRR: {rr}</p>
              
              {/* Conditional Result/Requirement Row */}
              {isSecondInnings && target !== null && (
                <div className="mt-0.5">
                  {match.status === 'completed' ? (
                    <p className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.2em] animate-pulse">
                      {getWinnerMessage(match)}
                    </p>
                  ) : (
                    <p className="text-[8px] font-bold text-amber-400 uppercase tracking-[0.2em]">
                      Target: {target} • Need {runsNeeded} from {ballsRemaining} balls (RRR: {rrr})
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <button onClick={onToggleScoreboard} className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all">Card</button>
        </div>

        {/* Crease Stats */}
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="space-y-2">
             {[batter1, batter2].map((b, i) => (
               <div key={i} className={`flex justify-between items-center ${i === 1 ? 'opacity-40' : ''}`}>
                 <span className="text-xs font-bold text-white truncate max-w-[80px]">{b?.name || '--'}{i === 0 ? '*' : ''}</span>
                 <span className="text-sm font-bebas text-emerald-400 tracking-wide">{b?.runs || 0}<span className="text-[10px] font-sans ml-1 text-slate-500">({b?.balls || 0})</span></span>
               </div>
             ))}
          </div>

          <div className="flex flex-col justify-center border-l border-white/5 pl-4">
            <p className="text-[7px] font-bold text-slate-600 uppercase tracking-widest mb-1">Current Bowler</p>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">{bowler?.name || '--'}</span>
              <span className="text-sm font-bebas text-emerald-400">{bowler?.overs || 0}.{bowler ? (bowler.balls % 6) : 0}-{bowler?.wickets || 0}</span>
            </div>
          </div>
        </div>

        {/* History Reel (Current Over Only) */}
        <div className="bg-black/40 px-5 py-3 flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-4 overflow-hidden">
            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest shrink-0">Over {overs}:</span>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
               {currentOverBalls.map((b) => (
                 <div key={b.ballId} className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold border ${b.isWicket ? 'bg-red-600 border-red-400 text-white' : b.runs >= 4 ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-white/10 text-slate-400'}`}>
                   {getBallLabel(b)}
                 </div>
               ))}
               {currentOverBalls.length === 0 && <span className="text-[8px] text-slate-700 font-bold uppercase">Waiting for first ball...</span>}
            </div>
          </div>
          <button 
            onClick={() => setShowFullHistory(true)}
            className="ml-2 text-[7px] font-black text-emerald-500/60 uppercase tracking-widest hover:text-emerald-400 underline underline-offset-4 decoration-emerald-500/20"
          >
            View All
          </button>
        </div>
      </div>

      {/* Full History Overlay */}
      {showFullHistory && (
        <div className="fixed inset-0 bg-black/95 z-[2000] p-6 flex flex-col backdrop-blur-xl animate-in fade-in zoom-in duration-200">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bebas text-emerald-400 tracking-widest">BALL BY BALL</h3>
              <button 
                onClick={() => setShowFullHistory(false)}
                className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white text-xl"
              >
                x
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
              {groupedOvers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                  <span className="text-4xl mb-4">🏏</span>
                  <p className="font-bold uppercase tracking-widest text-[10px]">No balls recorded yet</p>
                </div>
              ) : (
                groupedOvers.slice().reverse().map((over, idx) => {
                  const overNum = groupedOvers.length - idx - 1;
                  return (
                    <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/5">
                      <div className="flex justify-between items-center mb-3">
                         <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">OVER {overNum + 1}</span>
                         <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                           {over.reduce((sum, b) => sum + (b.runs + (b.isExtra && (b.extraType === 'wide' || b.extraType === 'noball') ? 1 : 0)), 0)} RUNS
                         </span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {over.map(b => (
                          <div key={b.ballId} className="flex flex-col items-center gap-1.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border ${b.isWicket ? 'bg-red-600 border-red-400 text-white' : b.runs >= 4 ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-white/10 text-slate-400'}`}>
                              {getBallLabel(b)}
                            </div>
                            <span className="text-[6px] font-bold text-slate-600 uppercase truncate max-w-[40px]">{b.striker.split(' ')[0]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
           </div>
           
           <div className="pt-6">
              <button 
                onClick={() => setShowFullHistory(false)}
                className="w-full bg-emerald-600 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest text-white shadow-xl"
              >
                CLOSE HISTORY
              </button>
           </div>
        </div>
      )}
    </>
  );
};

export default LiveScorecard;
