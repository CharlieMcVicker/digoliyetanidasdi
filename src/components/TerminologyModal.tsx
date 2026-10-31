import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Gauge,
  HelpCircle,
  Languages,
  Volume2,
  X,
} from 'lucide-react';

export interface TerminologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TerminologyModal: React.FC<TerminologyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [showUnderTheHood, setShowUnderTheHood] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-base text-slate-900">
              How Digoliyetanidasdi Works
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 leading-relaxed">
          <section>
            <h4 className="font-semibold text-slate-900 text-sm mb-1.5 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-sky-600" />
              Listening Word-by-Word
            </h4>
            <p className="text-xs leading-relaxed">
              <strong>Digoliyetanidasdi</strong> (ᏗᎪᎵᏰᏔᏂᏓᏍᏗ) connects written Cherokee and English translations directly to spoken audio recordings. Click the <strong>Play</strong> button to hear the whole phrase, or <strong>click directly on any Cherokee word</strong> to jump right to that moment in the recording. You can also slow down playback to <code>0.75x</code> or <code>0.5x</code> to hear pronunciation details clearly.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
              <Languages className="w-4 h-4 text-sky-600" />
              Two Ways to Spell Cherokee in English Letters
            </h4>
            <p className="text-xs mb-2.5">
              Different Cherokee dictionaries and learning programs write Cherokee sounds in English letters differently. You can search using whichever style you know best:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-900 mb-1">
                  1. Standard Spelling (d/t)
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Used in the 1975 Durbin Feeling Dictionary and most community classes. Uses <strong>d</strong>, <strong>g</strong>, <strong>j</strong>, and <strong>ch</strong> (for example: <code>gadu</code> for bread, <code>anichuja</code> for boys, <code>adalenisgv</code> for beginning).
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-900 mb-1">
                  2. Linguistic Spelling (t/th)
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Highlights the difference between soft sounds (<strong>t</strong>, <strong>k</strong>, <strong>ts</strong>) and sounds spoken with a puff of air (<strong>th</strong>, <strong>kh</strong>, <strong>tsh</strong>) — for example: <code>katu</code>, <code>anitshutsa</code>, <code>atalenihskv</code>.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-emerald-600" />
              Computer-Generated Word Timing & Quality Colors
            </h4>
            <p className="text-xs mb-2.5">
              A computer model listened to every recording and matched the spoken audio to the written transcript. Because fluent elders speak naturally — sometimes blending words, speaking quickly, or dropping quiet vowels — the computer's timing is sometimes approximate. Hover your mouse over any word or badge to inspect its exact confidence percentage:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                <strong>Clear match (≥ 80%)</strong>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Crisp audio alignment. Great for studying word pronunciation.
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                <strong>Approximate (10–79%)</strong>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Fast conversational speech or natural vowel dropping.
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                <strong>Uncertain (&lt; 10%)</strong>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Background noise or overlap. Very uncertain matches (&lt;5%) are hidden unless you click "Include uncertain matches".
                </p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-semibold text-slate-900 text-sm mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-teal-600" />
              About the Recording Collections
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>
                <strong>1975 Dictionary</strong>: Clear studio recordings of headwords and example sentences from the Durbin Feeling <em>Cherokee-English Dictionary</em>.
              </li>
              <li>
                <strong>New Testament</strong>: Continuous chapter readings of the Cherokee New Testament.
              </li>
              <li>
                <strong>Saving the Voices (ᎠᏂᏬᏂᏍᎩ ᎤᏂᏍᏆᏂᎪᏛᎢ)</strong>: Unscripted interviews with fluent Cherokee elders sharing stories, history, and everyday conversation.
              </li>
            </ul>
          </section>

          {/* Expandable Under the Hood Section for Curious Readers / Linguists */}
          <section className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowUnderTheHood(prev => !prev)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-sky-700 cursor-pointer"
            >
              {showUnderTheHood ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
              <span>Under the Hood (For Linguists & Technical Readers)</span>
            </button>

            {showUnderTheHood && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-600">
                <p>
                  <strong>Acoustic Forced Alignment:</strong> Recordings are aligned using a Wav2Vec2-CTC acoustic model trained on historical Cherokee speech, paired with Silero Voice Activity Detection (VAD) soft-masking.
                </p>
                <p>
                  <strong>Vowel Dropping (Syncope) & Intrusions:</strong> Conversational Cherokee frequently drops unstressed short vowels and inserts unwritten phonetic aspiration (<em>h</em>) or glottal stops (<code>'</code>). Our alignment pipeline uses a syncope- and intrusion-aware dynamic programming trellis so conversational elisions align cleanly without derailing word boundaries.
                </p>
                <p>
                  <strong>Orthographic Transduction:</strong> Standard (d/t) queries are normalized to unaspirated/aspirated (t/th) representations at search time, with an automatic broad fallback (stripping <em>h</em> and glottal stops) so learners can find words even if aspiration is omitted.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg text-xs cursor-pointer shadow-xs"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
