# JP Phrases

A small offline-capable web app for learning Japanese travel phrases, with audio.

**Open the app:** https://gerryclark.github.io/jp-phrases/

## Install on iPhone
1. Open the link above in **Safari** (while online).
2. Tap **Share → Add to Home Screen**.
3. Launch it from the home screen and wait for **"✓ Available offline"** on the Home screen.
   All phrases and audio are now stored on the phone and work in Airplane Mode.

After the phrase list is updated, open the app once while online to pick up the changes.

## What's inside
- 40 phrases in 8 categories: Greetings, Courtesy, Communication, Directions,
  Transportation, Food & Drink, Shopping, Emergency
- Japanese audio (normal and slow) and English audio for every phrase
- **Flashcards** — tap to hear, rate "Got it" / "Still learning"
- **Auto-play** — hands-free listening; "Still learning" phrases get a second round at the end
- **Quiz** — four types: Listening, English → Japanese, Reading, and Say it
  (speak, reveal, mark yourself). Missed phrases can be retried at the end.
- **Filters** — study several categories at once, and focus on phrases not yet
  marked "Got it" or still marked "Still learning". Works for every mode.

Study progress is saved in the browser on each device; it isn't synced between devices.

## About this repo
This is the **published, read-only copy** of the app. It is generated automatically by
`publish.py` in the main project (a Flask app where phrases are added, edited, and their
audio is generated with gTTS). Don't edit files here by hand — except this README,
everything is overwritten on each publish.
