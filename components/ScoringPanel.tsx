import React, { useState, useMemo } from 'react';
import { Match, Innings, BallRecord, PlayerStats, BowlerStats } from '../types';
import PlayerModal from './PlayerModal';
import { generateLiveCommentary } from '../services/commentaryService';
import { AudioService } from '../services/audioService';
import { runScoringTests } from '../services/testService';

interface ScoringPanelProps {
  match: Match;
  onUpdate: (match: Match) => void;
  isAdmin?: boolean;
}

const ScoringPanel: React.FC<ScoringPanelProps> = ({ match, onUpdate, isAdmin }) => {
  const [showPlayerModal, setShowPlayerModal] = useState<'batsman' | 'bowler' | null>(null);
  const [showOversModal, setShowOversModal] = useState<boolean>(false);
  const [wicketModal, setWicketModal] = useState<boolean>(false);
  const [extraRunSelector, setExtraRunSelector] = useState<{type: 'wide'|'noball'|'bye'|'legbye'} | null>(null);
  const [attributionModal, setAttributionModal] = useState<{type: any, runs: number} | null>(null);
  const [fielderPrompt, setFielderPrompt] = useState<{type: string, runs?: number} | null>(null);
  const [fielderName, setFielderName] = useState('');
  const [oversInput, setOversInput] = useState(match.totalOvers.toString());
  const [lastCommentary, setLastCommentary] = useState<string>('Ready for the next delivery.');
  const [isCommentaryLoading, setIsCommentaryLoading] = useState(false);

  const innIdx = (match.currentInnings || 1) - 1;
  const currentInnings = match.innings[innIdx] as Innings;
  if (!currentInnings) return null;

  const isCreaseReady = currentInnings.currentBatsmenNames.length === 2 && !!currentInnings.currentBowlerName;

  const ensureReady = () => {
    if (currentInnings.currentBatsmenNames.length < 2) {
      setShowPlayerModal('batsman');
      return false;
    }
    if (!currentInnings.currentBowlerName) {
      setShowPlayerModal('bowler');
      return false;
    }
    return true;
  };

  const findOrAddBatter = (inn: Innings, name: string): PlayerStats => {
    let p = inn.batsmen.find(b => b.name === name);
    if (!p) {
      p = { name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
      inn.batsmen.push(p);
    }
    return p;
  };

  const findOrAddBowler = (inn: Innings, name: string): BowlerStats => {
    let p = inn.bowlers.find(b => b.name === name);
    if (!p) {
      p = { name, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 };
      inn.bowlers.push(p);
    }
    return p;
  };

  const recalculate = (m: Match) => {
    const localIdx = (m.currentInnings || 1) - 1;
    const inn = m.innings[localIdx] as Innings;
    if (!inn) return;
    
    const history = [...inn.ballByBall];
    const pendingBowler = inn.currentBowlerName;
    const battingOrder = inn.batsmen.map(b => b.name);

    // Reset current stats
    inn.runs = 0; inn.wickets = 0; inn.balls = 0; inn.extras = 0; inn.currentOverBalls = [];
    inn.batsmen.forEach(p => { 
        p.runs = 0; p.balls = 0; p.fours = 0; p.sixes = 0; p.out = false; 
        delete p.dismissal; delete p.fielder; delete p.bowler;
    });
    inn.bowlers.forEach(p => { p.overs = 0; p.balls = 0; p.runs = 0; p.wickets = 0; p.maidens = 0; });

    // Set starting strikers
    inn.currentBatsmenNames = [];
    if (battingOrder.length > 0) inn.currentBatsmenNames.push(battingOrder[0]);
    if (battingOrder.length > 1) inn.currentBatsmenNames.push(battingOrder[1]);
    
    let nextBatterIdx = battingOrder.length > 2 ? 2 : battingOrder.length;
    let activeBowler: string | null = null; 

    // Replay history
    history.forEach((ball) => {
      if (ball.manualStrikeRotate) {
        if (inn.currentBatsmenNames.length === 2) inn.currentBatsmenNames = [inn.currentBatsmenNames[1], inn.currentBatsmenNames[0]];
        return;
      }

      const striker = findOrAddBatter(inn, ball.striker);
      const bowler = findOrAddBowler(inn, ball.bowler);
      
      activeBowler = ball.bowler;
      inn.currentOverBalls.push(ball);

      if (ball.isWicket) {
        inn.wickets++; 
        inn.balls++; 
        striker.balls++; 
        striker.runs += ball.runs; 
        striker.out = true;
        striker.dismissal = ball.wicketType; 
        striker.fielder = ball.fielderName; 
        striker.bowler = ball.bowler;
        
        if (ball.wicketType !== 'Run Out') bowler.wickets++;
        bowler.balls++; 
        bowler.runs += ball.runs;
        
        const outIdx = inn.currentBatsmenNames.indexOf(ball.striker);
        if (outIdx !== -1) {
            if (nextBatterIdx < battingOrder.length) {
                inn.currentBatsmenNames[outIdx] = battingOrder[nextBatterIdx];
                nextBatterIdx++;
            } else {
                inn.currentBatsmenNames.splice(outIdx, 1);
            }
        }
      } else if (ball.isExtra) {
        if (ball.extraType === 'wide' || ball.extraType === 'noball') {
          inn.runs += (ball.runs + 1);
          bowler.runs += (ball.runs + 1);
          if (ball.runsToBatsman) {
            striker.runs += ball.runs;
            inn.extras += 1;
          } else {
            inn.extras += (ball.runs + 1);
          }
          if (ball.extraType === 'noball') striker.balls++;
        } else {
          inn.runs += ball.runs; inn.extras += ball.runs; inn.balls++; bowler.balls++; striker.balls++;
        }
      } else {
        inn.runs += ball.runs; inn.balls++; striker.runs += ball.runs; striker.balls++; bowler.runs += ball.runs; bowler.balls++;
        if (ball.runs === 4) striker.fours++; if (ball.runs === 6) striker.sixes++;
      }

      // Strike rotation logic
      let rotate = false;
      if (!ball.isExtra && (ball.runs % 2 !== 0)) rotate = true;
      if (ball.isExtra && (ball.runs % 2 !== 0) && ['bye', 'legbye', 'noball'].includes(ball.extraType!)) rotate = true;
      if (rotate && inn.currentBatsmenNames.length === 2) inn.currentBatsmenNames = [inn.currentBatsmenNames[1], inn.currentBatsmenNames[0]];

      // Over completion logic
      const legalBalls = inn.currentOverBalls.filter(b => !(b.isExtra && (b.extraType === 'wide' || b.extraType === 'noball'))).length;
      if (legalBalls === 6) {
        inn.currentOverBalls = []; 
        bowler.overs++; 
        bowler.balls = 0;
        if (inn.currentBatsmenNames.length === 2) inn.currentBatsmenNames = [inn.currentBatsmenNames[1], inn.currentBatsmenNames[0]];
        activeBowler = null; 
      }
    });

    // POST-REPLAY PERSISTENCE
    let finalBowler: string | null = activeBowler;
    if (!finalBowler && pendingBowler) {
      const lastBall = history.length > 0 ? history[history.length - 1] : null;
      if (!lastBall || lastBall.bowler !== pendingBowler) {
        finalBowler = pendingBowler;
      }
    }
    
    if (inn.currentOverBalls.length > 0) {
      finalBowler = inn.currentOverBalls[0].bowler;
    }

    inn.currentBowlerName = finalBowler;

    const target = (m.innings[0]?.runs ?? 0) + 1;
    if ((m.currentInnings === 2 && inn.runs >= target) || inn.wickets >= 10 || (inn.balls / 6) >= m.totalOvers) {
      m.status = m.currentInnings === 1 ? 'inningsBreak' : 'completed';
    } else {
      m.status = 'live';
    }
    onUpdate(m);
  };

  const validateAndAddBall = async (ball: Partial<BallRecord>) => {
    if (!ensureReady()) return;

    const updatedMatch: Match = JSON.parse(JSON.stringify(match));
    const inn = updatedMatch.innings[innIdx] as Innings;
    if (!inn) return;
    
    const newBall: BallRecord = {
      ballId: `b_${Date.now()}`,
      runs: ball.runs || 0,
      isExtra: !!ball.isExtra,
      extraType: ball.extraType,
      isWicket: !!ball.isWicket,
      wicketType: ball.wicketType,
      fielderName: ball.fielderName,
      striker: inn.currentBatsmenNames[0] || '',
      bowler: inn.currentBowlerName || '',
      runsToBatsman: ball.runsToBatsman ?? !ball.isExtra
    };

    inn.ballByBall.push(newBall);
    recalculate(updatedMatch);
    setExtraRunSelector(null);
    setAttributionModal(null);
    setWicketModal(false);
    setFielderPrompt(null);
    setFielderName('');

    setIsCommentaryLoading(true);
    try {
      const result = await generateLiveCommentary(updatedMatch, newBall);
      setLastCommentary(result.text);
      if (result.audioBase64) AudioService.getInstance().playPcm(result.audioBase64);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCommentaryLoading(false);
    }
  };

  const availablePlayers = useMemo(() => {
    const isBatsman = showPlayerModal === 'batsman';
    const teamName = isBatsman ? currentInnings.battingTeam : currentInnings.bowlingTeam;
    const teamPlayerNames = match.allPlayers[teamName] || [];
    
    if (isBatsman) {
      const outNames = currentInnings.batsmen.filter(p => p.out).map(p => p.name);
      return teamPlayerNames.filter((name: string) => !outNames.includes(name) && !currentInnings.currentBatsmenNames.includes(name));
    } else {
      const history = currentInnings.ballByBall;
      let restrictedBowler: string | null = null;
      
      const legalBallsInHistory = history.filter(b => !b.manualStrikeRotate && !(b.isExtra && (b.extraType === 'wide' || b.extraType === 'noball')));
      if (legalBallsInHistory.length > 0 && (legalBallsInHistory.length % 6 === 0)) {
        restrictedBowler = legalBallsInHistory[legalBallsInHistory.length - 1].bowler;
      }
      
      return teamPlayerNames.filter((name: string) => name !== restrictedBowler);
    }
  }, [showPlayerModal, currentInnings, match.allPlayers]);

  const bowlingTeamPlayers = useMemo(() => {
    return match.allPlayers[currentInnings.bowlingTeam] || [];
  }, [match.allPlayers, currentInnings.bowlingTeam]);

  return (
    <div className="flex flex-col gap-3 flex-1 h-full py-1 overflow-hidden">
      <div className={`grid ${isAdmin ? 'grid-cols-6' : 'grid-cols-5'} gap-1.5 shrink-0 px-1`}>
        <button onClick={() => setShowPlayerModal('batsman')} className="bg-emerald-900/40 border border-emerald-500/20 py-2 rounded-lg text-[7px] font-bold uppercase tracking-widest text-emerald-400">BATTER</button>
        <button onClick={() => setShowPlayerModal('bowler')} className="bg-emerald-900/40 border border-emerald-500/20 py-2 rounded-lg text-[7px] font-bold uppercase tracking-widest text-emerald-400">BOWLER</button>
        <button onClick={() => {
            if (!ensureReady()) return;
            const up: Match = JSON.parse(JSON.stringify(match));
            const inn = up.innings[innIdx] as Innings;
            if (!inn) return;
            inn.ballByBall.push({ ballId: `m_${Date.now()}`, striker: currentInnings.currentBatsmenNames[0], bowler: 'N/A', runs: 0, isExtra: false, isWicket: false, manualStrikeRotate: true });
            recalculate(up);
        }} className="bg-slate-800 border border-white/5 py-2 rounded-lg text-sm">⇄</button>
        <button onClick={() => {
            const up: Match = JSON.parse(JSON.stringify(match));
            const inn = up.innings[innIdx] as Innings;
            if (!inn) return;
            inn.ballByBall.pop();
            recalculate(up);
        }} className="bg-slate-800 border border-white/5 py-2 rounded-lg text-[7px] font-bold uppercase text-slate-500">Undo</button>
        <button onClick={() => setShowOversModal(true)} className="bg-slate-800 border border-white/5 py-2 rounded-lg text-[7px] font-bold uppercase text-slate-500">OVRS</button>
        {isAdmin && (
          <button onClick={() => runScoringTests(recalculate)} className="bg-amber-900/20 border border-amber-500/10 py-2 rounded-lg text-[7px] font-bold uppercase text-amber-500/60">TEST</button>
        )}
      </div>

      <div className="bg-gradient-to-r from-emerald-950/40 to-black/60 mx-1 rounded-2xl border border-emerald-500/10 p-4 flex flex-col gap-2 relative min-h-[90px] justify-center shadow-inner">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[7px] font-black text-emerald-500 uppercase tracking-[0.2em]">CricAI Commentary</span>
          </div>
          {isCommentaryLoading && <div className="flex gap-0.5 items-end h-3"><div className="w-0.5 bg-emerald-500/60 animate-sound"></div><div className="w-0.5 bg-emerald-500/60 animate-sound" style={{animationDelay:'0.1s'}}></div><div className="w-0.5 bg-emerald-500/60 animate-sound" style={{animationDelay:'0.2s'}}></div></div>}
        </div>
        <p className={`text-xs font-medium leading-relaxed italic transition-all duration-700 ${isCommentaryLoading ? 'opacity-30' : 'opacity-100'}`}>
          "{lastCommentary}"
        </p>
      </div>

      <div className="flex-1 relative">
        {!isCreaseReady && match.status === 'live' && (
           <div 
             onClick={ensureReady} 
             className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-3xl cursor-pointer border border-white/5"
           >
             <div className="bg-emerald-600 px-6 py-3 rounded-2xl shadow-2xl animate-bounce">
                <span className="text-[10px] font-black uppercase tracking-widest">Select {currentInnings.currentBatsmenNames.length < 2 ? 'Batter' : 'Bowler'}</span>
             </div>
           </div>
        )}
        
        <div className={`grid grid-cols-4 gap-2 px-1 h-full transition-all ${(match.status !== 'live' || !isCreaseReady) ? 'opacity-50 grayscale' : ''}`}>
          {[0, 1, 2, 3].map(r => (
            <button key={r} onClick={() => ensureReady() && validateAndAddBall({runs: r})} className="bg-slate-800/80 rounded-2xl font-bebas text-3xl border border-white/5 shadow-xl transition-all active:scale-90 hover:bg-slate-700 flex items-center justify-center">{r}</button>
          ))}
          <button onClick={() => ensureReady() && validateAndAddBall({runs: 4})} className="bg-emerald-900/60 rounded-2xl font-bebas text-3xl border border-emerald-500/30 text-emerald-400 shadow-xl active:scale-90 flex items-center justify-center">4</button>
          <button onClick={() => ensureReady() && validateAndAddBall({runs: 6})} className="bg-emerald-900/60 rounded-2xl font-bebas text-3xl border border-emerald-500/30 text-emerald-400 shadow-xl active:scale-90 flex items-center justify-center">6</button>
          <button onClick={() => ensureReady() && setExtraRunSelector({type: 'wide'})} className="bg-amber-900/40 rounded-2xl font-bebas text-2xl border border-amber-500/30 text-amber-500 shadow-xl active:scale-90 flex items-center justify-center">WD</button>
          <button onClick={() => ensureReady() && setExtraRunSelector({type: 'noball'})} className="bg-amber-900/40 rounded-2xl font-bebas text-2xl border border-amber-500/30 text-amber-500 shadow-xl active:scale-90 flex items-center justify-center">NB</button>
          <button onClick={() => ensureReady() && setExtraRunSelector({type: 'bye'})} className="bg-slate-800/40 rounded-2xl font-bebas text-2xl border border-white/5 text-slate-400 shadow-xl active:scale-90 flex items-center justify-center">BYE</button>
          <button onClick={() => ensureReady() && setExtraRunSelector({type: 'legbye'})} className="bg-slate-800/40 rounded-2xl font-bebas text-2xl border border-white/5 text-slate-400 shadow-xl active:scale-90 flex items-center justify-center">LB</button>
          <button onClick={() => ensureReady() && setWicketModal(true)} className="col-span-2 bg-red-950/40 rounded-2xl font-bebas text-3xl border border-red-500/30 text-red-500 shadow-xl active:scale-90 flex items-center justify-center tracking-widest">OUT</button>
        </div>
      </div>

      {attributionModal && (
        <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-8 text-center backdrop-blur-md">
          <div className="bg-slate-900 p-8 rounded-[2rem] w-full max-w-[320px] border border-white/10 shadow-2xl">
            <h4 className="text-xl font-bebas text-emerald-400 mb-2 uppercase tracking-widest">Attribution</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-8 leading-relaxed">Runs scored on this {attributionModal.type}?</p>
            <div className="grid gap-3 mb-8">
              <button onClick={() => validateAndAddBall({runs: attributionModal.runs, isExtra: true, extraType: attributionModal.type, runsToBatsman: true})} className="bg-emerald-600 border border-emerald-400/40 py-4 rounded-2xl font-bold text-[10px] uppercase text-white">Batter Hit</button>
              <button onClick={() => validateAndAddBall({runs: attributionModal.runs, isExtra: true, extraType: attributionModal.type, runsToBatsman: false})} className="bg-slate-800 border border-white/10 py-4 rounded-2xl font-bold text-[10px] uppercase text-slate-300">Team Extra</button>
            </div>
            <button onClick={() => setAttributionModal(null)} className="text-[8px] text-slate-600 uppercase font-bold tracking-widest">Cancel</button>
          </div>
        </div>
      )}

      {extraRunSelector && (
        <div className="fixed inset-0 bg-black/95 z-[400] flex items-center justify-center p-8 text-center backdrop-blur-md">
          <div className="bg-slate-900 p-8 rounded-[2rem] w-full max-w-[300px] border border-white/10 shadow-2xl">
            <h4 className="text-xl font-bebas text-amber-500 mb-4 uppercase tracking-widest">{extraRunSelector.type}</h4>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[0, 1, 2, 3, 4, 6].map(num => (
                <button key={num} onClick={() => {
                  if (extraRunSelector.type === 'wide') validateAndAddBall({runs: num, isExtra: true, extraType: 'wide', runsToBatsman: false});
                  else setAttributionModal({ type: extraRunSelector.type, runs: num });
                }} className="bg-slate-800 h-14 rounded-2xl font-bebas text-2xl border border-white/5 shadow-inner active:scale-90 hover:bg-slate-700 transition-all">{num}</button>
              ))}
            </div>
            <button onClick={() => setExtraRunSelector(null)} className="w-full py-3 bg-slate-800/40 rounded-xl font-bold text-[8px] uppercase text-slate-500 tracking-widest">Back</button>
          </div>
        </div>
      )}

      {wicketModal && (
        <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-6 text-center backdrop-blur-sm">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-[340px] border border-white/10 shadow-2xl">
            {!fielderPrompt ? (
              <>
                <h4 className="text-xl font-bebas text-red-500 mb-8 uppercase tracking-[0.2em]">WICKET!</h4>
                <div className="grid grid-cols-2 gap-2 mb-8">
                  {['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket', 'C & B'].map(type => (
                    <button key={type} onClick={() => { 
                      if (['Caught', 'Run Out', 'Stumped'].includes(type)) setFielderPrompt({ type }); 
                      else if (type === 'C & B') validateAndAddBall({isWicket: true, wicketType: 'Caught', fielderName: currentInnings.currentBowlerName || ''}); 
                      else validateAndAddBall({isWicket: true, wicketType: type}); 
                    }} className="bg-slate-800 py-3 rounded-xl font-bold text-[9px] uppercase tracking-widest border border-white/5 active:bg-red-900/20">{type}</button>
                  ))}
                </div>
                <button onClick={() => setWicketModal(false)} className="w-full py-3 bg-slate-800/40 rounded-xl font-bold text-[8px] uppercase text-slate-500 tracking-widest">Cancel</button>
              </>
            ) : (
              <div className="space-y-4 text-left flex flex-col max-h-[80vh]">
                <h4 className="text-lg font-bebas text-emerald-400 uppercase tracking-widest text-center">{fielderPrompt.type}</h4>
                
                <div className="flex-1 overflow-hidden flex flex-col space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Select Fielder ({currentInnings.bowlingTeam})</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1 custom-scrollbar max-h-48">
                    {bowlingTeamPlayers.map((name: string) => (
                      <button 
                        key={name} 
                        onClick={() => setFielderName(name)} 
                        className={`py-2 px-3 rounded-lg text-[9px] font-bold uppercase tracking-tighter border transition-all truncate text-left ${fielderName === name ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-black/40 border-white/5 text-slate-400 hover:border-emerald-500/40'}`}
                      >
                        {name}
                      </button>
                    ))}
                    {bowlingTeamPlayers.length === 0 && (
                      <div className="col-span-2 text-center py-4 bg-black/20 rounded-xl">
                        <p className="text-[8px] text-slate-600 uppercase font-bold">No squad found</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 mt-2">
                    <p className="text-[7px] font-bold text-slate-600 uppercase tracking-widest px-1">Or Manual Entry</p>
                    <input 
                      value={fielderName} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFielderName(e.target.value)} 
                      placeholder="Enter name..." 
                      className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500" 
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <button onClick={() => setFielderPrompt(null)} className="flex-1 py-3 bg-slate-800 rounded-xl text-[8px] font-bold uppercase text-slate-400">Back</button>
                  <button 
                    disabled={!fielderName}
                    onClick={() => validateAndAddBall({isWicket: true, wicketType: fielderPrompt.type, fielderName: fielderName, runs: 0})} 
                    className="flex-1 py-3 bg-emerald-600 disabled:opacity-50 rounded-xl text-[8px] font-bold uppercase text-white shadow-xl shadow-emerald-950/40"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showPlayerModal && (
        <PlayerModal 
          type={showPlayerModal} existingPlayers={availablePlayers} 
          onSelect={(name: string) => { 
            const up: Match = JSON.parse(JSON.stringify(match)); 
            const inn = up.innings[innIdx] as Innings; 
            if (!inn) return;
            
            // Explicitly check modal type to avoid narrowing issues in closure
            const currentModal = showPlayerModal;
            if (currentModal === 'batsman') { 
              findOrAddBatter(inn, name);
              if (!up.allPlayers[inn.battingTeam].includes(name)) up.allPlayers[inn.battingTeam].push(name); 
            } else if (currentModal === 'bowler') { 
              inn.currentBowlerName = name; 
              findOrAddBowler(inn, name);
              if (!up.allPlayers[inn.bowlingTeam].includes(name)) up.allPlayers[inn.bowlingTeam].push(name); 
            } 
            recalculate(up); 
            setShowPlayerModal(null); 
          }} 
          onClose={() => setShowPlayerModal(null)} 
        />
      )}

      {showOversModal && (
        <div className="fixed inset-0 bg-black/95 z-[450] flex items-center justify-center p-8 backdrop-blur-md">
           <div className="bg-slate-900 p-8 rounded-[2rem] border border-white/10 shadow-2xl w-full max-w-[280px]">
              <h4 className="text-xl font-bebas text-emerald-400 mb-6 uppercase text-center tracking-widest">Match Overs</h4>
              <input type="number" autoFocus value={oversInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOversInput(e.target.value)} className="w-full bg-black/40 border border-slate-800 rounded-xl py-4 mb-6 text-center text-2xl font-bebas text-white outline-none focus:ring-1 focus:ring-emerald-500" />
              <div className="grid grid-cols-2 gap-3"><button onClick={() => setShowOversModal(false)} className="py-3 bg-slate-800/40 rounded-xl font-bold text-[9px] uppercase text-slate-500 tracking-widest">Cancel</button><button onClick={() => { const val = parseFloat(oversInput); if(!isNaN(val)) { const up: Match = JSON.parse(JSON.stringify(match)); up.totalOvers = val; recalculate(up); setShowOversModal(false); } }} className="py-3 bg-emerald-600 rounded-xl font-bold text-[9px] uppercase text-white tracking-widest shadow-xl">Confirm</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ScoringPanel;
