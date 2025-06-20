// Simple SSE stream pushing random price every second
export async function GET() {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  let price = 100;

  const push = async () => {
    try{
      price += (Math.random() - 0.5);
      await writer.write(`data: ${JSON.stringify({ price })}\n\n`);
      setTimeout(push, 1000);
    }catch(err){
      console.error("error", err)
      try{
        writer.close();
      }catch{}
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
