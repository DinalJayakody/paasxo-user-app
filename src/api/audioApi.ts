import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  durationSeconds: number;
}

export const audioApi = {
  getAudioTracks: async (): Promise<AudioTrack[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.MEDIA.AUDIO_TRACKS);
    return Array.isArray(data) ? data : [];
  },
};
