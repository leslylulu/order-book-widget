// Simple SSE stream pushing random price every second

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  let price = 100;
  let closed = false;

  let timer: NodeJS.Timeout;

  const push = async () => {
    if (closed) return;
    try{
      price += (Math.random() - 0.5);
      await writer.write(`data: ${JSON.stringify({ price })}\n\n`);
      timer = setTimeout(push, 1000);
    }catch(err){
      closed = true;
      cleanup();
    }
  };

  // clean timer and judge if it was closed
  const cleanup = () => {
    if (!closed) {
      closed = true;
      clearTimeout(timer);
      try {
        writer.close();
      } catch (e) {
      }
    }
  };

  push();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
