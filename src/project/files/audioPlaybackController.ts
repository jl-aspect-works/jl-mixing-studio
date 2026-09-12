type StopPlayback = () => Promise<void> | void;

type ActivePlayback = {
  id: string;
  stop: StopPlayback;
  exclusive: boolean;
};

let activePlayback: ActivePlayback | null = null;

async function claim(id: string, stop: StopPlayback, exclusive: boolean) {
  if (activePlayback?.id === id) {
    activePlayback = { id, stop, exclusive };
    return true;
  }
  if (activePlayback?.exclusive && !exclusive) return false;
  const previous = activePlayback;
  activePlayback = null;
  if (previous) await previous.stop();
  activePlayback = { id, stop, exclusive };
  return true;
}

export const claimAudioPlayback = (id: string, stop: StopPlayback) => claim(id, stop, false);

export const claimExclusiveAudioPlayback = (id: string, stop: StopPlayback) => claim(id, stop, true);

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
