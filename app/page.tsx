import dynamic from 'next/dynamic';
const OrderBook = dynamic(() => import('@/components/OrderBook'), { ssr: false });
export default function Home() {
  return <OrderBook />;
}
