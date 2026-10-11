import { AgentStateSchema, type AgentState } from '@kele/schemas';
const terminal=new Set<AgentState>(['completed','failed','error','cancelled','expired']);
const edges:Partial<Record<AgentState,readonly AgentState[]>>={
 idle:['waking','understanding'],waking:['listening'],listening:['transcribing'],
 transcribing:['understanding','needs_input'],understanding:['needs_input','planning'],
 needs_input:['understanding'],planning:['awaiting_confirmation','executing'],
 awaiting_confirmation:['executing'],executing:['paused','completed'],
 paused:['planning','awaiting_confirmation','executing']
};
export function isTerminal(state:AgentState){return terminal.has(state);}
export function transition(current:AgentState,next:AgentState):AgentState{
 AgentStateSchema.parse(current);AgentStateSchema.parse(next);
 if(isTerminal(current))throw new Error('RUN_TERMINAL');
 if(next==='cancelled'||next==='failed'||next==='error'||next==='expired'||edges[current]?.includes(next))return next;
 throw new Error('INVALID_TRANSITION');
}
// This is a pure guard only. Durable execution, authorization and tools are not implemented here.
