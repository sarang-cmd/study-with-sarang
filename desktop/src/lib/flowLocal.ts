import type { LocalListener } from './flowEngine';
import type { VoiceEvent } from './desktop';

/**
 * The desktop's built-in recognizer (Windows speech, running on this computer). It only knows the phrases in the command list, which is
 * exactly why it is fast, free and private. While Flow is listening it collects what that recognizer reports.
 */
export function createVoiceLocal(subscribe: (cb: (event: VoiceEvent) => void) => () => void, minConfidence: () => number, settleMs = 650): LocalListener {
  let off: (() => void) | null = null;
  let heard = '', free = '', hypothesis = '';
  return {
    start() {
      heard = ''; free = ''; hypothesis = ''; off?.();
      off = subscribe((event) => {
        // Free speech (the general grammar) is looser, so it only counts when nothing from the command list was heard.
        if (event.type === 'heard' && event.text && event.grammar === 'dict') { if (event.confidence >= Math.max(0.25, minConfidence() - 0.25)) free = event.text; }
        else if (event.type === 'heard' && event.text && event.confidence >= minConfidence()) heard = event.text;
        else if (event.type === 'hypothesis' && event.text) hypothesis = event.text;
      });
    },
    async stop() {
      await new Promise<void>((resolve) => setTimeout(resolve, settleMs)); // The recognizer needs a moment after the last word
      off?.(); off = null;
      return heard || free || hypothesis;
    },
  };
}
