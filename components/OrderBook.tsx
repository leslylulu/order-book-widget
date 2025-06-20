'use client';
import { useState, useEffect, useRef } from "react";
import { Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
/* TODO:
   – connect to /api/order-stream via EventSource or fetch‑stream
   – maintain bid/ask list in React state
   – render Material UI table, last price ticker, loading/error states
   – clean up on unmount
*/

enum Side {
  Bid = 'bid',
  Ask = 'ask',
}

enum PriceDirection {
  Up = 'up',
  Down = 'down',
  Same = 'same',
}

type PriceRecord = {
  price: number;
  time: string;
  side: 'bid' | 'ask';
  direction?: PriceDirection;
}


export default function OrderBook() {
  const [connected, setConnected] = useState(false);
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const recordPriceUpdate = (price: number) => {
    const now = new Date().toLocaleTimeString();

    let direction: PriceDirection;
    let side: Side;

    if (lastPrice === null) {
      direction = PriceDirection.Same;
      side = Math.random() < 0.5 ? Side.Bid : Side.Ask;
    } else if (price > lastPrice) {
      direction = PriceDirection.Up;
      side = Side.Ask;
    } else if (price < lastPrice) {
      direction = PriceDirection.Down;
      side = Side.Bid;
    } else {
      direction = PriceDirection.Same;
      side = Math.random() < 0.5 ? Side.Bid : Side.Ask;
    }

    const record: PriceRecord = { price, time: now, side, direction };

    setLastPrice(price);
    setRecords((prev) => {
      const updated = [record, ...prev];
      return updated.slice(0, 20);
    });

  }

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
        recordPriceUpdate(data.price);
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

  console.log('priceHistory ==>', records);

  return <Paper sx={{ p: 2 }}>
    <Typography variant="subtitle1" gutterBottom>
      Last Price: <strong>{lastPrice?.toFixed(4) ?? '--'}</strong>
    </Typography>
    <Table size="small">

      <TableHead>
        <TableRow>
          <TableCell>Time</TableCell>
          <TableCell>Side</TableCell>
          <TableCell>Price</TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {records.map((entry, index) => (
          <TableRow key={index}>
            <TableCell>{index}--{entry.time}</TableCell>
            <TableCell>{entry.side}</TableCell>
            <TableCell
              sx={{
                color:
                  entry.direction === PriceDirection.Up
                    ? 'green'
                    : entry.direction === PriceDirection.Down
                    ? 'red'
                    : 'inherit',
                fontWeight: entry.direction !== PriceDirection.Same ? 600 : 400,
              }}
            >
              {entry.price?.toFixed(4) ?? '--'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Paper>;
};
