'use client';
import { useState, useEffect, useRef } from "react";
/* TODO:
   – connect to /api/order-stream via EventSource or fetch‑stream
   – maintain bid/ask list in React state
   – render Material UI table, last price ticker, loading/error states
   – clean up on unmount
*/

export default function OrderBook() {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    const eventSource = new EventSource('/api/order-stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('connection to server opened');
      setConnected(true);
    };
    eventSource.onmessage = (event) => {
      try{
        const data = JSON.parse(event.data);
        console.log('onmessage data:', data);
      }
      catch (error) {
        console.error('error parsing event data:', error);
      }
    }
    eventSource.onerror = (error) => {
      console.error('eventsource error:', error);
      setConnected(false);
      eventSource.close();

      if(!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('reconnecting to server...');
          reconnectTimeoutRef.current = null;
          connect();
        }, 3000);
      }
    };
  }
  useEffect(() => {
    
    connect();

    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [])
  return <div>OrderBook</div>;
}
