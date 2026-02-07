
import { Match, BallRecord } from '../types';

/**
 * Runs a suite of logical tests against a provided 'recalculate' implementation.
 * Outputs results to the console.
 */
export const runScoringTests = (recalculateFn: (m: Match) => void) => {
  console.group("ðŸ CricScore Pro - Logic Test Suite");

  const createMockMatch = (): Match => ({
    id: 'test_id',
    team1: 'INDIA', team2: 'AUS',
    totalOvers: 1, password: 'pw', status: 'live', currentInnings: 1,
    innings: [{
      battingTeam: 'INDIA', bowlingTeam: 'AUS', runs: 0, wickets: 0, balls: 0, extras: 0,
      batsmen: [{ name: 'B1', runs: 0, balls: 0, fours: 0, sixes: 0, out: false }, { name: 'B2', runs: 0, balls: 0, fours: 0, sixes: 0, out: false }],
      bowlers: [{ name: 'Bowler', overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 }],
      currentBatsmenNames: ['B1', 'B2'], currentBowlerName: 'Bowler', ballByBall: [], currentOverBalls: []
    }, null],
    allPlayers: { 'INDIA': ['B1', 'B2', 'B3'], 'AUS': ['Bowler'] }
  });

  // Test 1: Single Run Strike Rotation
  const testStrikeRotation = () => {
    const m = createMockMatch();
    m.innings[0].ballByBall.push({ ballId: '1', runs: 1, isExtra: false, isWicket: false, striker: 'B1', bowler: 'Bowler' });
    recalculateFn(m);
    const success = m.innings[0].currentBatsmenNames[0] === 'B2';
    console.log(success ? "âœ… Strike Rotation: Passed" : "âŒ Strike Rotation: Failed (B2 should be on strike)");
  };

  // Test 2: Over Completion Rotation
  const testOverCompletion = () => {
    const m = createMockMatch();
    for(let i=0; i<6; i++) {
        m.innings[0].ballByBall.push({ ballId: `b${i}`, runs: 0, isExtra: false, isWicket: false, striker: 'B1', bowler: 'Bowler' });
    }
    recalculateFn(m);
    // 6 dots. B1 stayed on strike during over, but should swap after over ends.
    const success = m.innings[0].currentBatsmenNames[0] === 'B2' && m.innings[0].balls === 6;
    console.log(success ? "âœ… Over Completion: Passed" : "âŒ Over Completion: Failed");
  };

  // Test 3: Wicket Replacement
  const testWicketReplacement = () => {
    const m = createMockMatch();
    m.innings[0].batsmen.push({ name: 'B3', runs: 0, balls: 0, fours: 0, sixes: 0, out: false });
    m.innings[0].ballByBall.push({ ballId: 'w1', runs: 0, isExtra: false, isWicket: true, wicketType: 'Bowled', striker: 'B1', bowler: 'Bowler' });
    recalculateFn(m);
    const success = m.innings[0].wickets === 1 && m.innings[0].currentBatsmenNames.includes('B3');
    console.log(success ? "âœ… Wicket Replacement: Passed" : "âŒ Wicket Replacement: Failed");
  };

  testStrikeRotation();
  testOverCompletion();
  testWicketReplacement();
  console.groupEnd();
};
