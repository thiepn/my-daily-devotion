import {describe,it,expect} from 'vitest';
import {greeting,parseJourneyPreference} from './journal-model';
describe('journal introduction preferences',()=>{
 it('validates optional names without accounts or automatic enrollment',()=>{expect(parseJourneyPreference(null)).toEqual({version:1,name:'',dismissed:false});expect(parseJourneyPreference({name:' Anna ',dismissed:true})).toEqual({version:1,name:'Anna',dismissed:true});expect(parseJourneyPreference({name:'x'.repeat(90)}).name).toHaveLength(60);expect(parseJourneyPreference({name:3,dismissed:'yes'})).toEqual({version:1,name:'',dismissed:false});});
 it('greets by the current local hour',()=>{expect(greeting(0)).toBe('Good morning');expect(greeting(11)).toBe('Good morning');expect(greeting(12)).toBe('Good afternoon');expect(greeting(18)).toBe('Good evening');});
});
