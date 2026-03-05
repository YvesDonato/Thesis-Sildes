import {
  getPresenterState,
  subscribeToPresenter,
  type PresenterState,
} from "../../../lib/presenter-state";

export const dynamic = "force-dynamic";

function formatSlideEvent(state: PresenterState) {
  return `event: slide\ndata: ${JSON.stringify(state)}\n\n`;
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let closed = false;

  const runCleanup = () => {
    if (closed) {
      return;
    }

    closed = true;
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (state: PresenterState) => {
        controller.enqueue(encoder.encode(formatSlideEvent(state)));
      };

      send(getPresenterState());
      const unsubscribe = subscribeToPresenter(send);
      const keepAliveTimer = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 25_000);

      cleanup = () => {
        clearInterval(keepAliveTimer);
        unsubscribe();
      };
    },
    cancel() {
      runCleanup();
    },
  });

  request.signal.addEventListener("abort", runCleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
