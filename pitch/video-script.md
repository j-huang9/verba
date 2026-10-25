# Verba: demo video script (about 2:15, opens with our 15-second intro)

For the submitted video only. The live judging demo has its own setup.
**Style:** a straightforward walkthrough. It's mostly a screen recording of the phone, with a picture-in-picture of the patient's face whenever the camera matters, and a plain voice-over (VO) that says what each step does. There's no cinematic intro and no music bed (or keep it very quiet).
**Every shot is the real app** (not `?mock`), and the numbers on screen are whatever the app actually shows.

| Time | Section | Length |
|---|---|---|
| 0:00 | Intro (already recorded) | 15 s |
| 0:15 | Introducing Verba | 12 s |
| 0:27 | Walkthrough: 7 steps | 75 s |
| 1:42 | How we built it | 30 s |
| 2:12 | Close | 5 s |

---

## 0:00 Intro (15 s, already recorded)

**VO (as recorded):** "Imagine being awake in the ICU with your family beside you, and not being able to say a word. In one study, more than 8 in 10 patients on breathing tubes struggled just to be understood. They're cut off from the people they love, right when they need them most."

**On screen during the "8 in 10" line:** **82%** of ventilated patients rated communication as "extremely hard". Small text: *Thapa et al., Birat J Health Sci 2019 (n = 48)*
*(The study's wording is "rated communication as extremely hard". "Struggled to be understood" is a fair paraphrase. To match it exactly, say "found it extremely hard just to communicate".)*

## 0:15 Introducing Verba (12 s)

**Transition:** cut from the last intro shot to the phone, with the Verba home screen filling the frame.

**On screen, one at a time:**
1. **~800,000** U.S. adults go on a ventilator each year. *(Wunsch et al., Crit Care Med 2010)*
2. **Over half** are awake enough to communicate. *(Happ et al., Heart & Lung 2015)*
3. **Verba**: *Their words, in their own voice.*

**VO:** "Every year, about 800,000 adults in the U.S. go on a ventilator, and more than half are awake enough to communicate. Verba gives them a way. It's a phone app that reads their lips and speaks for them, in their own voice. Here's how it works."

## 0:27 Walkthrough (75 s)

Show a step label in the corner for each step, e.g. **"1 · Add a patient"**.
*(If Claire's tab bar has landed, steps 1–3 happen on the **Patients** tab, steps 4–6 on **Talk**, and step 7 on **Conversation**. Briefly show the tab being tapped, so viewers see the app's layout.)*

**1 · Add a patient (6 s)**
**Screen:** tap **Add a patient**, enter the name, "ICU, bed 4", pick **Daughter**, then tap Next.
**VO:** "A family member adds the patient: name, room, and who they are to them."

**2 · Clone their voice (13 s)**
**Screen:**
1. Tap **Upload a video or voice memo** and pick a clip.
2. Check the consent box.
3. **"Creating their voice…"** appears (cut the wait).
4. The sample plays: *"Hi, it's me. I can hear you."*
5. **"Saving their phrases on this phone"** counts up.

**VO:** "Next, we upload any old video of them talking. Cartesia clones the voice in a few seconds, and Verba generates 50 common phrases in that voice and saves them on the phone, so speaking works offline."
**Caption:** *Cartesia Instant Voice Clone + Sonic 3.6 text-to-speech*

**3 · Teach it their lips (17 s; the capture is sped up, the "why" is not)**
**Screen:**
1. **(6 s, sped up 6×)** The Teach screen: **"Ask them to mouth: 'I'm thirsty'"**, with the grid filling hands-free. Picture-in-picture: the patient mouthing. A small timer counts up to about 2:00.
2. **(5 s, normal speed)** The result card: **"On takes it didn't learn from, first guess right"**, before → after.
3. **(6 s)** A simple graphic: two bars side by side.
   - **Sure enough to speak without asking for a blink: 12% → 33% of readings**
   - **Right phrase in the top 3: 81% → 87%**

   Small text: *measured on people the model never saw · all 4 test subjects improved*

**VO:** "Out of the box, Verba's model has only seen other people's lips, so with a new patient it's often unsure. So the patient mouths each phrase three times, and Verba retrains part of its model on those examples, right on the phone. Then it's sure enough to speak without asking 33% of the time, up from 12%."
**Caption:** *One-time · about 2 minutes · runs on the phone, nothing uploaded*

*(Why this beat matters: the capture looks repetitive, so the VO answers "why bother" before viewers ask. It's done once per patient, and it makes every later conversation faster: fewer "Did you mean…?" pauses.)*

**4 · Lip reading: confident (10 s)**
**Screen:**
1. Tap **Start talking**, then **Listen**. The lip outline turns on.
2. Picture-in-picture: the patient mouths **"I'm thirsty."**
3. The confidence bar fills above 70% and the cloned voice says it.

**VO:** "Now we tap Listen and they mouth 'I'm thirsty'. Verba is confident, so it speaks it in their voice."

**5 · Lip reading: not sure → blink to confirm (11 s)**
**Screen:**
1. The patient mouths **"I'm scared."**
2. The bar fills amber: **"Not entirely sure"**, with the top 3 guesses.
3. Picture-in-picture: the patient holds their eyes closed. The ring fills, "Confirmed by their blink" appears, and the voice plays.

**VO:** "When it's below 70%, it doesn't speak. It shows its top guesses, and the patient confirms by holding their eyes closed. Two blinks would move to the next guess."

**6 · Phrase board (12 s)**
**Screen:**
1. A wrong read: tap **"None of these → phrase board"**.
2. Highlight **"Likely from their lips"**, with the right phrase at the top. Tap it.
3. Switch to blink scan (sped up). A long blink picks **Questions**, then **"When does the tube come out?"**, and it plays.

**VO:** "If every guess is wrong, the phrase board opens with the model's next-best guesses at the top. It also covers all 50 phrases, and the patient can scan through them hands-free with long blinks."

**7 · Undo + conversation log (6 s)**
**Screen:**
1. Tap **Undo** on a message ("Undone").
2. Open **Conversation**: each entry shows how it was confirmed, and the undone one is crossed out.
3. Tap **Share**.

**VO:** "Any message can be undone, and everything is logged with how it was confirmed, so it can be shared with the nurse."

## 1:42 How we built it (30 s)

**Visual:** [`pitch/pipeline-slide.html`](pipeline-slide.html). Open it in Chrome, click **Full screen**, start the screen recording, then press **Space**. The 6 boxes and the bottom band light up one at a time, timed to this VO (30 s). The tool chips under the title (MediaPipe · Python + scikit-learn · TypeScript + React · Cartesia · Vercel) stay visible throughout.

| Slide cue | Box that lights up | VO at that moment |
|---|---|---|
| 0 s | 01 MediaPipe face tracking | "Here's how we built it. MediaPipe tracks the face in each frame…" |
| 5 s | 02 40 lip points | "…and we keep 40 lip points, corrected for head tilt." |
| 9 s | 03 3,840 motion numbers | "We recorded our team mouthing each phrase, turned each take into 3,840 motion numbers…" |
| 13 s | 04 Neural net, trained by us | "…and trained a neural net in Python, testing it only on people it never saw." |
| 18 s | 05 Calibrated confidence | "We calibrated its confidence…" |
| 22 s | 06 Speak, or ask first | "…and ported it to run in the phone's browser." |
| 25 s | Band: everything on the phone | "Nothing but the voice clip leaves the phone." |

**VO (about 70 words):** "Here's how we built it. MediaPipe tracks the face in each frame, and we keep 40 lip points, corrected for head tilt. We recorded our team mouthing each phrase, turned each take into 3,840 motion numbers, and trained a neural net in Python, testing it only on people it never saw. We calibrated its confidence and ported it to run in the phone's browser. Nothing but the voice clip leaves the phone."

*(If the VO runs faster or slower, change the `CUES` line near the bottom of `pipeline-slide.html`: it lists the second each box lights up.)*

**More detail for the Devpost or judges' questions** (not in the VO):
- Training data: we recorded our team with `silentvoice.py` on a laptop webcam. It saves lip landmarks only, never video.
- We tested a logistic regression and a small neural net under leave-one-person-out. The neural net won by about 12 points of first-guess accuracy.
- MediaPipe Face Landmarker finds 478 face points per frame. We keep the 40 lip points plus 4 anchors (outer eye corners, nose tip, chin).
- The lips are re-centered on the nose, rotated so the eyes are level, and scaled by the distance between the eyes. That removes head position, tilt and distance from the camera.
- Each take is resampled to 24 frames. The features are lip shape over time, velocity, and the average shape: 3,840 numbers in all.
- The neural net has one hidden layer of 128 units. It was trained in Python, exported to JSON, and runs in TypeScript on the phone. A test checks that the phone version matches Python to about 1e-15.
- Confidence is calibrated with temperature scaling, fitted on people the model didn't train on.

## 2:12 Close (5 s)

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
- [ ] Intro (done) + "82%" caption
- [ ] Bridge: home screen + 800k / over-half captions + Verba title
- [ ] 1 · Add patient
- [ ] 2 · Upload → consent → creating → sample → phrases saving
- [ ] 3 · Teach grid sped up (+ picture-in-picture, timer) → result card → "12% → 33%" bars graphic
- [ ] 4 · Listen → "I'm thirsty", 70%+ → voice
- [ ] 5 · "I'm scared", below 70% → blink-hold → voice
- [ ] 6 · Wrong read → None of these → Likely → tap; blink scan → "When does the tube come out?"
- [ ] 7 · Undo → Conversation → Share
- [ ] "How we built it" slide: screen-record pipeline-slide.html in full screen, press Space
- [ ] End slide

## Sources for the stats
0. Thapa D, Dahal A, Singh R. *Communication difficulties and psychological stress in patients receiving mechanical ventilation.* Birat J Health Sci. 2019;4(2). (82.29% of 48 patients rated general communication as extremely hard; https://www.nepjol.info/index.php/bjhs/article/view/25452)
1. Wunsch H, et al. *The epidemiology of mechanical ventilation use in the United States.* Crit Care Med. 2010;38:1947–53. (About 800,000 adults a year; cited in West J Emerg Med 2015, https://pmc.ncbi.nlm.nih.gov/articles/PMC4644038)
2. Happ MB, et al. *The number of mechanically ventilated ICU patients meeting communication criteria.* Heart & Lung. 2015. (53.9% of 2,671 patients; https://news.osu.edu/more-than-half-of-icu-patients-on-ventilators-have-the-ability-to-communicate/)
3. Khalaila R, et al. *Communication difficulties and psychoemotional distress in patients receiving mechanical ventilation.* Am J Crit Care. 2011;20(6):470–9. (Inability to speak was the strongest predictor of psychoemotional distress; n = 65.)
