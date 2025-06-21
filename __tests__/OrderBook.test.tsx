import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import "@testing-library/jest-dom";
import OrderBook from "@/components/OrderBook";
import MockEventSource from "@/__mocks__/MockEventSource";

// replace any
global.EventSource = MockEventSource as unknown as typeof EventSource;

describe('OrderBook Comp', () => {
	let mockEventSource: MockEventSource;

	beforeEach(() => {
		jest.useFakeTimers();

		global.EventSource = jest.fn().mockImplementation((url) => {
			mockEventSource = new MockEventSource(url);
			return mockEventSource;
		}) as any
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.useRealTimers();
	});

	test('connect to the /api/order-stream', () => {
		render(<OrderBook/>);
		expect(global.EventSource).toHaveBeenCalledWith('/api/order-stream');
	})

	test('display loading state initially', () => {
		render(<OrderBook/>)

		expect(screen.getByTestId('price-loading-skeleton')).toBeInTheDocument();

		const skeletonCells = screen.getAllByTestId('skeleton-cell');
		expect(skeletonCells.length).toBe(30);
		
	});

	test('displays price update from api stream', async () => {
		render(<OrderBook/>);
		await act( async () => {
			jest.advanceTimersByTime(50);
			mockEventSource.onopen?.(new Event('open'));
		});

		await act(async () => {
			mockEventSource.emitMessage({ price: 100.5021 });
		})

		await waitFor(() => {
			const priceEl = screen.getByText((content, element) => {
				return element.tagName.toLowerCase() === 'span' && content.includes('100.50');
			});
			expect(priceEl).toBeInTheDocument();

		}, { timeout: 5000});


	})
})