# Verba: demo video script (about 2:00)

For the submitted video only. The live judging demo has its own setup.
**Style:** a straightforward walkthrough. It's mostly a screen recording of the phone, with a picture-in-picture of the patient's face whenever the camera matters, and a plain voice-over (VO) that says what each step does. There's no cinematic intro and no music bed (or keep it very quiet).
**Every shot is the real app** (not `?mock`), and the numbers on screen are whatever the app actually shows.

| Time | Section | Length |
|---|---|---|
| 0:00 | Title + problem (stats) | 20 s |
| 0:20 | What Verba is | 7 s |
| 0:27 | Walkthrough: 7 steps | 75 s |
| 1:42 | How it works + results | 15 s |
| 1:57 | Close | 5 s |

---

## 0:00 Title + problem (20 s)

**Slide 1 (3 s):** **Verba**, with the line *Lip reading + voice cloning for ICU patients on breathing tubes.*

**Slide 2 (17 s):** the stats appear one at a time.
- **~800,000** U.S. adults are put on a ventilator each year.¹
- **54%** of ventilated patients are awake and responsive enough to communicate.²
- Being unable to speak is the **strongest predictor of distress** in these patients.³
- Today's tools: letter boards, pen and paper, guessing. They depend on hand strength and attention the patient often doesn't have.

**VO:** "About 800,000 adults in the U.S. go on a ventilator every year. More than half of them are awake and able to communicate, but the breathing tube means they can't make a sound. And not being able to speak is the strongest predictor of distress for these patients. Today they're left with letter boards and guessing."

Small text on screen:
1. Wunsch et al., *Crit Care Med* 2010
2. Happ et al., *Heart & Lung* 2015 (n = 2,671)
3. Khalaila et al., *Am J Crit Care* 2011

## 0:20 What Verba is (7 s)

**Screen:** the Verba home screen.
**VO:** "Verba is a phone app. It reads the patient's lips, and says what they mean in their own voice. Here's the full flow."

## 0:27 Walkthrough (75 s)

Show a step label in the corner for each step, e.g. **"1 · Add a patient"**.

**1 · Add a patient (8 s)**
**Screen:** tap **Add a patient**, enter the name, "ICU, bed 4", pick **Daughter**, then tap Next.
**VO:** "A family member adds the patient: name, room, and who they are to them."

**2 · Clone their voice (14 s)**
**Screen:**
1. Tap **Upload a video or voice memo** and pick a clip.
2. Check the consent box.
3. **"Creating their voice…"** appears (cut the wait).
4. The sample plays: *"Hi, it's me. I can hear you."*
5. **"Saving their phrases on this phone"** counts up.

**VO:** "Next, we upload any old video of them talking. Cartesia clones the voice in a few seconds, and Verba generates 50 common phrases in that voice and saves them on the phone, so speaking works offline."
**Caption:** *Cartesia Instant Voice Clone + Sonic 3.6 text-to-speech*

**3 · Teach it their lips (11 s, sped up)**
**Screen:**
1. The Teach screen: **"Ask them to mouth: 'I'm thirsty'"**, with the grid filling, plus a picture-in-picture of the patient mouthing.
2. Return to normal speed on the result card ("On takes it didn't learn from, first guess right: before → after").

**VO:** "Then the patient mouths 8 phrases, 3 times each. Verba fine-tunes the model to their lips on the phone, then tests itself on takes it didn't train on."
**Caption:** *Fine-tuned on the phone in under a second*

**4 · Lip reading: confident (10 s)**
**Screen:**
1. Tap **Start talking**, then **Listen**. The lip outline turns on.
2. Picture-in-picture: the patient mouths **"I'm thirsty."**
3. The confidence bar fills above 70% and the cloned voice says it.

**VO:** "Now we tap Listen and they mouth 'I'm thirsty'. Verba is confident, so it speaks it in their voice."

**5 · Lip reading: not sure → blink to confirm (12 s)**
**Screen:**
1. The patient mouths **"I'm scared."**
2. The bar fills amber: **"Not entirely sure"**, with the top 3 guesses.
3. Picture-in-picture: the patient holds their eyes closed. The ring fills, "Confirmed by their blink" appears, and the voice plays.

**VO:** "When it's below 70%, it doesn't speak. It shows its top guesses, and the patient confirms by holding their eyes closed. Two blinks would move to the next guess."

**6 · Phrase board (13 s)**
**Screen:**
1. A wrong read: tap **"None of these → phrase board"**.
2. Highlight **"Likely from their lips"**, with the right phrase at the top. Tap it.
3. Switch to blink scan (sped up). A long blink picks **Questions**, then **"When does the tube come out?"**, and it plays.

**VO:** "If every guess is wrong, the phrase board opens with the model's next-best guesses at the top. It also covers all 50 phrases, and the patient can scan through them hands-free with long blinks."

**7 · Undo + conversation log (7 s)**
**Screen:**
1. Tap **Undo** on a message ("Undone").
2. Open **Conversation**: each entry shows how it was confirmed, and the undone one is crossed out.
3. Tap **Share**.

**VO:** "Any message can be undone, and everything is logged with how it was confirmed, so it can be shared with the nurse."

## 1:42 How it works + results (15 s)

**Slide: pipeline diagram**
```
phone camera → MediaPipe face mesh → 40 lip points → 3,840 motion features
→ neural net (exported from Python, runs in the browser)
→ calibrated confidence → speak (≥ 70%) or confirm by blink
```
**Slide: results**, measured only on people the model never saw (leave-one-person-out, 8 phrases):

| | Right phrase in top 3 |
|---|---|
| Shared model | 81% |
| After teaching it their lips | 87% |

**VO:** "Everything runs on the phone, and no video leaves the device. On people the model has never seen, the right phrase is in the top 3 81% of the time, and 87% after teaching it their lips."

## 1:57 Close (5 s)

**Slide:** **Verba**, *Their words, in their own voice.* Below it: team names · Cal Hacks 2026 · GitHub link.
**VO:** "Verba. Their words, in their own voice."

---

## Before filming
1. **Phone:**
   1. Open https://verba-voice.vercel.app.
   2. Turn on Do Not Disturb.
   3. Set brightness high.
   4. Use Control Center screen recording with the **mic on**, so the cloned voice is captured.
2. **Picture-in-picture:** film the patient's face with a second phone or laptop at the same time. Clap once at the start so the editor can sync the two recordings.
3. **One patient set up for steps 4–7,** with the voice cloned and Teach done. Film steps 1–3 on a fresh patient, using the same clip so the voice matches.
4. **The lip reader only knows 8 phrases:**
   - yes
   - no
   - I'm in pain
   - I can't breathe
   - Where's my mom?
   - I'm thirsty
   - I'm scared
   - Thank you

   "When does the tube come out?" is reached through the board only.
5. **Step 4 needs a reading of 70% or more, and step 5 needs one below 70%.** Do several takes of each and keep real ones. Don't fake numbers.
6. **Record the VO separately** and lower it whenever the app speaks.
7. **If Teach's held-out result is weak** on film day, show it anyway or cut the result card. Never edit the numbers.

## Shot checklist
- [ ] Title + stats slides
- [ ] Home screen
- [ ] 1 · Add patient
- [ ] 2 · Upload → consent → creating → sample → phrases saving
- [ ] 3 · Teach grid (+ picture-in-picture) → result card
- [ ] 4 · Listen → "I'm thirsty", 70%+ → voice
- [ ] 5 · "I'm scared", below 70% → blink-hold → voice
- [ ] 6 · Wrong read → None of these → Likely → tap; blink scan → "When does the tube come out?"
- [ ] 7 · Undo → Conversation → Share
- [ ] Pipeline + results slides
- [ ] End slide

## Sources for the stats
1. Wunsch H, et al. *The epidemiology of mechanical ventilation use in the United States.* Crit Care Med. 2010;38:1947–53. (About 800,000 adults a year; cited in West J Emerg Med 2015, https://pmc.ncbi.nlm.nih.gov/articles/PMC4644038)
2. Happ MB, et al. *The number of mechanically ventilated ICU patients meeting communication criteria.* Heart & Lung. 2015. (53.9% of 2,671 patients; https://news.osu.edu/more-than-half-of-icu-patients-on-ventilators-have-the-ability-to-communicate/)
3. Khalaila R, et al. *Communication difficulties and psychoemotional distress in patients receiving mechanical ventilation.* Am J Crit Care. 2011;20(6):470–9. (Inability to speak was the strongest predictor of psychoemotional distress; n = 65.)
