import React from 'react';
import { CaptureFlow, CaptureFlowPayload } from '../components/mediaCreate/CaptureFlow';
import { reelApi } from '../api/reelApi';

const MAX_REEL_SECONDS = 180;

export default function CreateReelScreen() {
  const handleSubmit = async (payload: CaptureFlowPayload) => {
    await reelApi.createReel({
      mediaUri: payload.mediaUri,
      mimeType: payload.mimeType,
      thumbnailUri: payload.thumbnailUri,
      caption: payload.caption,
      durationSeconds: payload.durationSeconds,
      filterName: payload.filterName,
      captionText: payload.captionText,
      captionColor: payload.captionColor,
      captionX: payload.captionX,
      captionY: payload.captionY,
      emoji: payload.emoji,
      emojiX: payload.emojiX,
      emojiY: payload.emojiY,
      audioTrackId: payload.audioTrackId,
      audioTrackUrl: payload.audioTrackUrl,
      audioVolume: payload.audioVolume,
    });
  };

  return (
    <CaptureFlow
      maxVideoSeconds={MAX_REEL_SECONDS}
      allowPhoto={false}
      requireCaption
      allowMusic
      captionPlaceholder="Write a caption for your reel..."
      submitLabel="Post Reel"
      submittingLabel="Posting…"
      doneLabel="Posted!"
      onSubmit={handleSubmit}
    />
  );
}
