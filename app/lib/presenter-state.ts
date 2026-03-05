export type PresenterState = {
  slideIndex: number;
  revealStep: number;
  version: number;
  updatedAt: string;
};

type Subscriber = (state: PresenterState) => void;

const subscribers = new Set<Subscriber>();

let presenterState: PresenterState = {
  slideIndex: 0,
  revealStep: 0,
  version: 0,
  updatedAt: new Date().toISOString(),
};

function emitPresenterState() {
  for (const subscriber of subscribers) {
    try {
      subscriber({ ...presenterState });
    } catch (error) {
      console.error("Presenter subscriber callback failed:", error);
    }
  }
}

export function getPresenterState() {
  return { ...presenterState };
}

export function setPresenterCursor(slideIndex: number, revealStep: number) {
  const normalizedSlideIndex = Math.max(0, Math.floor(slideIndex));
  const normalizedRevealStep = Math.max(0, Math.floor(revealStep));
  if (
    normalizedSlideIndex === presenterState.slideIndex &&
    normalizedRevealStep === presenterState.revealStep
  ) {
    return getPresenterState();
  }

  presenterState = {
    slideIndex: normalizedSlideIndex,
    revealStep: normalizedRevealStep,
    version: presenterState.version + 1,
    updatedAt: new Date().toISOString(),
  };
  emitPresenterState();
  return getPresenterState();
}

export function setPresenterSlide(slideIndex: number) {
  return setPresenterCursor(slideIndex, 0);
}

export function subscribeToPresenter(listener: Subscriber) {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}
