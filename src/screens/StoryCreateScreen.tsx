import React from 'react';
import { CaptureFlow, CaptureFlowPayload } from '../components/mediaCreate/CaptureFlow';
import { storyApi } from '../api/storyApi';

const MAX_STORY_SECONDS = 30;

export default function StoryCreateScreen() {
  const handleSubmit = async (payload: CaptureFlowPayload) => {
    await storyApi.createStory({
      mediaUri: payload.mediaUri,
      mediaType: payload.mediaType,
      mimeType: payload.mimeType,
      durationSeconds: payload.durationSeconds,
      filterName: payload.filterName,
      captionText: payload.captionText,
      captionColor: payload.captionColor,
      captionX: payload.captionX,
      captionY: payload.captionY,
      emoji: payload.emoji,
      emojiX: payload.emojiX,
      emojiY: payload.emojiY,
      isBoomerang: payload.isBoomerang,
      audioTrackId: payload.audioTrackId,
      audioTrackUrl: payload.audioTrackUrl,
      audioVolume: payload.audioVolume,
      taggedUserIds: payload.taggedUserIds,
      captionStyle: payload.captionStyle,
      captionScale: payload.captionScale,
      locationName: payload.locationName,
      locationPlaceId: payload.locationPlaceId,
      locationLat: payload.locationLat,
      locationLng: payload.locationLng,
      locationX: payload.locationX,
      locationY: payload.locationY,
      effect: payload.effect,
      soundOff: payload.soundOff,
    });
  };

  return (
    <CaptureFlow
      maxVideoSeconds={MAX_STORY_SECONDS}
      allowPhoto
      allowBoomerang
      allowMusic
      allowTags
      storyMode
      submitLabel="Share Story"
      submittingLabel="Uploading…"
      doneLabel="Shared!"
      onSubmit={handleSubmit}
    />
  );
}
