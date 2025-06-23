'use client';
import { useState, useEffect, useRef } from "react";
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { Paper, Alert, Box, Card, TableContainer, Typography, Table, TableBody, TableCell, TableHead, TableRow, Skeleton, Chip, alpha } from "@mui/material";
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
  '&:last-child td': {
    borderBottom: 0
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
  const MAX_RECONNECT_ATTEMPTS = 5;
  const MAX_LENGTH = 20;

  const [connected, setConnected] = useState(false);
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reconnectCount, setReconnectCount] = useState(0)
  const [highMark, setHighMark] = useState<number>(0);
  const [lowMark, setLowMark] = useState<number>(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const recordPriceUpdate = (price: number) => {
    setHighMark((prevHighMark) => {
      if (prevHighMark == 0 || price > prevHighMark) {
        return price;
      }
      return prevHighMark;
    });

    setLowMark((prevLowmark) => {
      if (prevLowmark == 0 || price < prevLowmark) {
        return price;
      }
      return prevLowmark;
    })
  
    setRecords((prev) => {
      let direction: PriceDirection;
      let side: Side;
      const now = new Date().toLocaleTimeString();
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

      return [{ price, timestamp: now, side, direction }, ...prev].slice(0, MAX_LENGTH);
    });
  }

  const connect = () => {
    setLoading(true);
    try{
      const eventSource = new EventSource('/api/order-stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setLoading(false);
        setReconnectCount(0);
      };
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const price = data?.price;
          if(price !== undefined && price !== null && !isNaN(Number(price))){
            recordPriceUpdate(data.price || 0);
          }else{
            console.warn('Receviced invalid price data = ', data)
          }
        }
        catch (error) {
          console.error('error parsing event data:', error);
        }
      }

      eventSource.onerror = (error) => {
        console.error('eventsource error:', error);
        eventSource.close();
        cleanupConnection();
        setReconnectCount(prev => prev + 1);
      };
    }catch(error){
      console.error('Failed to create EventSource:', error);
      cleanupConnection();
      setReconnectCount(prev => prev + 1);
    }
  }

  useEffect(() => {
    if(reconnectCount === 0 || connected) return;
    if (reconnectCount <= MAX_RECONNECT_ATTEMPTS) {
      const delay = 1000 * Math.pow(2, reconnectCount - 1);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, delay);
    } else {
      console.error(`Maximum reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached!`);
    }
    return () => {
      if(reconnectTimeoutRef.current){
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }

  }, [reconnectCount, connected])


  useEffect(() => {
    connect();

    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [])

  const cleanupConnection = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
    setLoading(false);
  };

  const getWaterMarkDisplay = (price: number) => {
    if(price >= highMark){
      return <Chip label="High" color="success" sx={{borderRadius: '8px'}}  />;
    }
    if(price <= lowMark){
      return <Chip label="Low" color="error" sx={{ borderRadius: '8px' }} />;
    }
    return null
  }

  // console.log(`connected is ${connected}, loading is ${loading}, reconnectCount is ${reconnectCount}`)
  // console.log('records ', records)
  // initial: connected = false, loading = true
  // connect failed: connected = false, loading = false
  // reconnecting: connected = false, loading = false
  // max attempts: connected = false, loading  = false
  return <Paper 
    sx={{ 
      margin: 'auto',
      m: 4,
      borderRadius: '1rem',
      boxShadow: 0
    }}>
    {!connected && reconnectCount > 0 && (
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

    <Box sx={{ mb: 3 }}>
      <Card elevation={0} sx={{
        borderRadius: 4,
        boxShadow: '0px 1px 8px rgba(0, 0, 0, 0.2)',
      }}>
        <Box 
          sx={{
            display: 'flex',
            width: "100%",
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
          <Box 
            sx={{
              display: 'flex',
              width: { xs: '100%', sm: '30%' },
              flexDirection: "column",
              alignItems: 'start',
              justifyContent: "center",
              pt: '1rem',
              pl: '1rem',
            }}
          >
            <Typography variant="h4" component="div" gutterBottom sx={{
              fontWeight: 'bold',
              color: records[0]?.direction === PriceDirection.Up
                ? 'success.main'
                : records[0]?.direction === PriceDirection.Down
                  ? 'error.main'
                  : 'text.primary'
            }}>
              {loading ? (
                <Skeleton data-testid="price-loading-skeleton" width={120} sx={{ display: "inline-block" }} />
              ) : (
                <>
                  <span>
                    {records[0]?.price?.toFixed(4) ?? '--'}
                  </span>
                  {records[0]?.direction === PriceDirection.Up &&
                    <ArrowDropUp fontSize="small" sx={{ verticalAlign: 'middle', ml: 0.5 }} />
                  }
                  {records[0]?.direction === PriceDirection.Down &&
                    <ArrowDropDown fontSize="small" sx={{ verticalAlign: 'middle', ml: 0.5 }} />
                  }
                </>
              )}
            </Typography>

            <Box sx={{
              display: 'flex',
              flexDirection: {sm: "column", md: "row"},
              alignItems: "center",
              gap: '1rem',
            }}>
              {
                loading ? <Skeleton
                  width={120}
                  height={32}
                  variant="rounded"
                  sx={{ borderRadius: '16px' }}
                /> : <Chip
                  icon={<ArrowDropUp />}
                  label={`High: ${highMark ? highMark.toFixed(4) : '--'}`}
                  color="success"
                  size="small"
                  variant="outlined"
                  sx={{
                    fontWeight: 'medium',
                    minWidth: '120px',
                    '& .MuiChip-icon': { color: 'success.main' }
                  }}
                />
              }
              {
                loading ? <Skeleton
                  width={120}
                  height={32}
                  variant="rounded"
                  sx={{ borderRadius: '16px' }}
                /> : <Chip
                  icon={<ArrowDropDown />}
                  label={`Low: ${lowMark ? lowMark.toFixed(4) : '--'}`}
                  color="error"
                  size="small"
                  variant="outlined"
                  sx={{
                    fontWeight: 'medium',
                    minWidth: '120px',
                    '& .MuiChip-icon': { color: 'error.main' }
                  }}
                />
              }
            </Box>
          </Box>

          <Box 
            sx={{ 
              minHeight: 200, 
              height: "100%", 
              width: { xs: '100%', sm: '70%' },
              marginTop: {xs: '1rem', sm: 0},
              }}
            >
            {loading ? (
              <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 1 }} />
            ) : records.length > 1 ? (
                <SparkLineChart
                  data={[...records].reverse().map(r => r.price)}
                  valueFormatter={(value) => value.toFixed(4)}
                  showTooltip
                  curve="monotoneX"
                  yAxis={{ 
                    min: records.length > 0 ? Math.min(...records.map(r => r.price)) * 0.9998 : undefined, 
                    max: records.length > 0 ? Math.max(...records.map(r => r.price)) * 1.0002 : undefined
                  }}
                  sx={{
                    width: '100%',
                    height: '200px',
                  }}
            />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '200px',
                  display: 'flex',
                  textAlign: 'center',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f7f7f7',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Not enough data to display chart
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Card>
    </Box>
    
    <TableContainer sx={{
      boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.1)',
    }}>
      <Table aria-label="price table">
        <TableHead>
          <TableRow>
            <StyledTableCell>Time</StyledTableCell>
            <StyledTableCell>Type</StyledTableCell>
            <StyledTableCell>Price</StyledTableCell>
            <StyledTableCell>Water Mark</StyledTableCell>
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
                  <span data-testid="price-value">
                    {item?.price?.toFixed(4)}
                    {item.direction === PriceDirection.Up && (
                      <ArrowDropUp data-testid="ArrowDropUpIcon" sx={{ color: 'inherit', ml: 0.5 }} />
                    )}
                    {item.direction === PriceDirection.Down && (
                      <ArrowDropDown data-testid="ArrowDropDownIcon"  sx={{ color: 'inherit', ml: 0.5 }} />
                    )}
                  </span>
                </BlinkingCell>
                <TableCell>
                  {getWaterMarkDisplay(item.price)}
                </TableCell>
              </StyledTableRow>
            )) : <TableRow>
                  <TableCell colSpan={4} align="center">No Recent Trades Available</TableCell>
              </TableRow>
          }
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>;
};
