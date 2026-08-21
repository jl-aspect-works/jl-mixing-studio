type StopPlayback = () => Promise<void> | void;

type ActivePlayback = {
  id: string;
  stop: StopPlayback;
};

let activePlayback: ActivePlayback | null = null;

export async function claimAudioPlayback(id: string, stop: StopPlayback) {
  if (activePlayback?.id === id) {
    activePlayback = { id, stop };
    return;
  }
  const previous = activePlayback;
  activePlayback = null;
  if (previous) await previous.stop();
  activePlayback = { id, stop };
}

export function releaseAudioPlayback(id: string) {
  if (activePlayback?.id === id) activePlayback = null;
}

export async function stopAudioPlayback(id: string) {
  if (activePlayback?.id !== id) return;
  const current = activePlayback;
  activePlayback = null;
  await current.stop();
}

export async function stopActiveAudioPlayback() {
  const current = activePlayback;
  activePlayback = null;
  if (current) await current.stop();
}
