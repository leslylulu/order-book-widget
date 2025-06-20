'use client';
import { useState, useEffect, useRef } from "react";
import { Paper, TableContainer, Typography, Table, TableBody, TableCell, TableHead, TableRow, useTheme, alpha } from "@mui/material";
import { tableCellClasses } from '@mui/material/TableCell';
import { styled } from '@mui/material/styles';

/* TODO:
   – connect to /api/order-stream via EventSource or fetch‑stream
   – maintain bid/ask list in React state
   – render Material UI table, last price ticker, loading/error states
   – clean up on unmount
*/

enum Side {
  Bid = 'Bid',
  Ask = 'Ask',
}

enum PriceDirection {
  Up = 'up',
  Down = 'down',
  Same = 'same',
}

type PriceRecord = {
  price: number;
  timestamp: string;
  side: Side;
  direction?: PriceDirection;
}

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: theme.palette.common.black,
    color: "white",
    fontWeight: 'bold',
    fontSize: "1.2rem",
    "&:first-of-type": {
      borderTopLeftRadius: 8,
    },
    "&:last-of-type": {
      borderTopRightRadius: 8,
    }
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
  },
  borderRadius: 8,
}));


export default function OrderBook() {
  const [connected, setConnected] = useState(false);
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const recordPriceUpdate = (price: number) => {
    const now = new Date().toLocaleTimeString();
    setRecords((prev) => {
      let direction: PriceDirection;
      let side: Side;

      const lastPriceValue = prev[0]?.price ?? 0;
      if (prev.length === 0) {
        direction = PriceDirection.Same;
        side = Math.random() < 0.5 ? Side.Bid : Side.Ask;
      } else if (price > lastPriceValue) {
        direction = PriceDirection.Up;
        side = Side.Ask;
      } else if (price < lastPriceValue) {
        direction = PriceDirection.Down;
        side = Side.Bid;
      } else {
        direction = PriceDirection.Same;
        side = Math.random() < 0.5 ? Side.Bid : Side.Ask;
      }
      return [{ price, timestamp: now, side, direction }, ...prev].slice(0, 20);
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


  return <Paper 
    sx={{ 
      margin: 'auto',
      m: 4,
      borderRadius: '16px',
      boxShadow: 0
    }}>
    <Typography variant="subtitle1" gutterBottom>
      Last Price: <strong>{records[0]?.price?.toFixed(4) ?? '--'}</strong>
    </Typography>
    
    <TableContainer>
      <Table aria-label="price table">
        <TableHead>
          <TableRow>
            <StyledTableCell>Time</StyledTableCell>
            <StyledTableCell>Type</StyledTableCell>
            <StyledTableCell>Price</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((item, index) => (
            <StyledTableRow key={index}>
              <TableCell>{item.timestamp}</TableCell>
              <TableCell>
                <Typography
                  sx={{
                    display: 'inline-block',
                    border: '1px solid',
                    fontSize: "0.8rem",
                    color:
                      item.side === Side.Bid
                        ? '#1976d2'
                        : '#9c27b0',
                    bgcolor:
                      item.side === Side.Bid
                        ? alpha('#1976d2', 0.08)
                        : alpha('#9c27b0', 0.08),
                    borderColor:
                      item.side === Side.Bid
                        ? '#64b5f6'
                        : '#ce93d8',
                    borderRadius: 2,
                    padding: '2px 6px',
                  }}
                >
                  {item.side}
                </Typography>
              </TableCell>
              <TableCell
                sx={{
                  color:
                  item.direction === PriceDirection.Up
                      ? 'green'
                      : item.direction === PriceDirection.Down
                      ? 'red'
                      : 'text.primary',
                  fontWeight: item.direction !== PriceDirection.Same ? 'bold' : 'normal',
                }}
              >
                {item.price.toFixed(4)}
              </TableCell>
            </StyledTableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>;
};
