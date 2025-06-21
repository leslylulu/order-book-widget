'use client';
import { useState, useEffect, useRef } from "react";
import { Paper, Alert, TableContainer, Typography, Table, TableBody, TableCell, TableHead, TableRow, Skeleton, alpha } from "@mui/material";
import { tableCellClasses } from '@mui/material/TableCell';
import { ArrowDropUp, ArrowDropDown } from '@mui/icons-material';
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


interface SideTypeBadgeProps {
  side: Side;
}

const SideTypeBadge = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'side',
})<SideTypeBadgeProps>(({ theme, side }) => ({
  display: 'inline-block',
  border: '1px solid',
  fontSize: "0.8rem",
  borderRadius: theme.shape.borderRadius * 2,
  padding: '0.2rem 0.5rem',
  color: side === Side.Bid ? '#1976d2' : '#9c27b0',
  backgroundColor: side === Side.Bid
    ? alpha('#1976d2', 0.08)
    : alpha('#9c27b0', 0.08),
  borderColor: side === Side.Bid ? '#64b5f6' : '#ce93d8',
}));

const BlinkingCell = styled(TableCell)`
  &.blink-green span {
    display: inline-block;
    animation: blinkGreenGlow 0.6s ease-in-out;
  }

  &.blink-red span {
    display: inline-block;
    animation: blinkRedGlow 0.6s ease-in-out;
  }

  @keyframes blinkGreenGlow {
    0% {
      color: #4caf50;
      text-shadow: 0 0 8px rgba(76, 175, 80, 0.8);
      transform: scale(1.15);
    }
    100% {
      color: inherit;
      text-shadow: none;
      transform: scale(1);
    }
  }

  @keyframes blinkRedGlow {
    0% {
      color: #f44336;
      text-shadow: 0 0 8px rgba(244, 67, 54, 0.8);
      transform: scale(1.15);
    }
    100% {
      color: inherit;
      text-shadow: none;
      transform: scale(1);
    }
  }
`;


export default function OrderBook() {
  const MAX_RECONNECT_ATTEMPTS = 10;

  const [connected, setConnected] = useState(false);
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reconnectCount, setReconnectCount] = useState(0)
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
    setLoading(true);
    const eventSource = new EventSource('/api/order-stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setLoading(false);
      setReconnectCount(0);
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
      setLoading(false);
      eventSource.close();

      if(!reconnectTimeoutRef.current) {
        if(reconnectCount < MAX_RECONNECT_ATTEMPTS){
          const nextAttempt = reconnectCount + 1;
          setReconnectCount(nextAttempt);

          const delay = Math.min(1000 * Math.pow(2, nextAttempt - 1), 30000);

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('reconnecting to server...');
            reconnectTimeoutRef.current = null;
            connect();
          }, delay);
        }
        else{
          console.error(`failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts!`);
        }
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
      borderRadius: '1rem',
      boxShadow: 0
    }}>
      
    {!connected && !loading && (
      <Alert
        data-testid="reconnect-alert"
        severity={reconnectCount < MAX_RECONNECT_ATTEMPTS ? "warning" : "error"}
        sx={{ mb: 2 }}
      >
        {reconnectCount < MAX_RECONNECT_ATTEMPTS
          ? `Attempting to reconnect... (${reconnectCount}/${MAX_RECONNECT_ATTEMPTS})`
          : `Maximum reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached!`
        }
      </Alert>
    )}

    <Typography variant="subtitle1" gutterBottom>
      Last Price: <strong>{loading ? <Skeleton
        data-testid="price-loading-skeleton" 
        sx={{
          display: "inline-block"
        }} 
        width={80}
      /> : records[0]?.price?.toFixed(4) ?? '--'}</strong>
    </Typography>
    
    <TableContainer sx={{
      boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.1)',
    }}>
      <Table aria-label="price table">
        <TableHead>
          <TableRow>
            <StyledTableCell>Time</StyledTableCell>
            <StyledTableCell>Type</StyledTableCell>
            <StyledTableCell>Price</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {
            loading ? (
              Array(10).fill(0).map((_, index) => (
                <StyledTableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton data-testid="skeleton-cell" /></TableCell>
                  <TableCell><Skeleton data-testid="skeleton-cell" /></TableCell>
                  <TableCell><Skeleton data-testid="skeleton-cell" /></TableCell>
                </StyledTableRow>
              ))
            ) : records.length > 0 ? records.map((item, index) => (
              <StyledTableRow key={index}>
                <TableCell>{item.timestamp}</TableCell>
                <TableCell>
                  <SideTypeBadge side={item.side}>
                    {item.side}
                  </SideTypeBadge>
                </TableCell>
                <BlinkingCell
                  className={
                    index === 0
                      ? item.direction === PriceDirection.Up
                        ? 'blink-green'
                        : item.direction === PriceDirection.Down
                          ? 'blink-red'
                          : ''
                      : ''
                  }
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
                  <span>
                    {item?.price?.toFixed(4)}
                    {item.direction === PriceDirection.Up && (
                      <ArrowDropUp data-testid="ArrowDropUpIcon" sx={{ color: 'inherit', ml: 0.5 }} />
                    )}
                    {item.direction === PriceDirection.Down && (
                      <ArrowDropDown data-testid="ArrowDropDownIcon"  sx={{ color: 'inherit', ml: 0.5 }} />
                    )}
                  </span>
                </BlinkingCell>

              </StyledTableRow>
            )) : <TableRow>
                  <TableCell colSpan={3} align="center">No Recent Trades Available</TableCell>
              </TableRow>
          }
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>;
};
