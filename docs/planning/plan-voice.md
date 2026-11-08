# Microphone

Second feature. Depends on the Plan agent preview.

## What it is

A Record button on Plan. The contractor speaks, the audio is transcribed, and the transcript goes through the same agent as typed text. The preview and confirm are unchanged.

## What the contractor sees

Record sits beside the message box.

- Tapping Record asks for the microphone and shows the elapsed time.
- It stops at two minutes, or when they tap Stop.
- While it uploads, the thread shows "Reading…".
- The transcript appears as their message. The agent preview appears under it.
- If the browser has no microphone, or permission is denied, the message box stays usable.
- If upload fails, the recording can be sent again. The words they had typed are not cleared.

## What is stored

No database change. No audio file is kept.

`POST /api/captures/voice` already accepts the recording, transcribes it, stores the transcript on `captures.transcript`, and discards the audio. This feature adds the button and sends the transcript into the agent preview.

Allowed audio is the set the route already accepts (webm, ogg, mp4, m4a, wav), up to 4 MB.

## Out of scope

- Saving recordings
- Live captions while they talk
- The phone app's native microphone
- Receipt photos

## Done when

Record a short description on Plan, see the transcript, see the same style of preview as a typed message, and confirm it. A failed upload can be retried. Typed messages still work with the recorder unused.
