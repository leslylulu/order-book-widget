import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import "@testing-library/jest-dom";
import OrderBook from "@/components/OrderBook";
import MockEventSource from "@/__mocks__/MockEventSource";

// replace any

describe('OrderBook Component', () => {
	let mockEventSource: MockEventSource;

	beforeEach(() => {
		jest.useFakeTimers();

		const mockedES = jest.fn().mockImplementation((url: string) => {
			mockEventSource = new MockEventSource(url);
			return mockEventSource;
		}) as unknown as jest.MockInstance<MockEventSource, [string]> & typeof MockEventSource;

		global.EventSource = mockedES;
		
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
		expect(skeletonCells.length).toBe(40);
		
	});

	test('displays price update from api stream', async () => {
		render(<OrderBook/>);
		await act( async () => {
			jest.advanceTimersByTime(50);
			mockEventSource.onopen?.(new Event('open'));
			mockEventSource.emitMessage({ price: 100.07703060864186 });
			jest.runAllTimers();
		});

		await waitFor(() => {
			const priceEl = screen.getByTestId('price-value');
			expect(priceEl).toBeInTheDocument();
			expect(priceEl.textContent).toContain('100.0770');
		}, { timeout: 1000});
	})

	test('show changed direction when price changes', async ()=> {
		render(<OrderBook/>);
		await act(async () => {
			jest.advanceTimersByTime(50);
			mockEventSource.onopen?.(new Event('open'));
			mockEventSource.emitMessage({ price: 110.07703060864186 });
			jest.runAllTimers();
		});

		await act(async () => {
			mockEventSource.emitMessage({ price: 125.07703060864186 });
			jest.runAllTimers();
		});

		await waitFor(() => {
			const arrowUp = document.querySelector('svg[data-testid="ArrowDropUpIcon"]');
			expect(arrowUp).toBeInTheDocument();
		}, { timeout: 1000 });

		await act(async () => {
			mockEventSource.emitMessage({ price: 96.07703060864186 });
			jest.runAllTimers();
		});

		await waitFor(() => {
			const arrowDown = document.querySelector('svg[data-testid="ArrowDropDownIcon"]');
			expect(arrowDown).toBeInTheDocument();
		}, { timeout: 1000 });

	});

	// life cycle: open -> error -> reconnect -> new connection
	test('attempts to reconnect', async() => {
		jest.useFakeTimers();

		render(<OrderBook/>)

		await act(async () => {
			jest.advanceTimersByTime(50)
			mockEventSource.onopen?.(new Event('open'));
			jest.runAllTimers();
		})

		expect(screen.queryByTestId('reconnect-alert')).not.toBeInTheDocument();

		await act(async () => {
			mockEventSource.onerror?.(new Event('error'))
			jest.runAllTimers();
		})

		await act(async () => {
			jest.advanceTimersByTime(1000);
			jest.runAllTimers();
		});

		const alert = screen.getByTestId('reconnect-alert');
		expect(alert).toBeInTheDocument();
		expect(alert).toHaveTextContent(/Attempting to reconnect/i);

		expect(global.EventSource).toHaveBeenCalledTimes(2);

		expect(global.EventSource).toHaveBeenNthCalledWith(1, '/api/order-stream');
		expect(global.EventSource).toHaveBeenNthCalledWith(2, '/api/order-stream');

	})

	test('reached the max attempts and show error alter', async () => {
		jest.useFakeTimers();
		const MAX_RECONNECT_ATTEMPTS = 5;

		render(<OrderBook/>);

		await act(async () => {
			jest.advanceTimersByTime(50);
			jest.runAllTimers();
		})

		for(let i = 0; i < MAX_RECONNECT_ATTEMPTS; i++){
			await act(async () => {
				// console.log(`Triggering error ${i + 1} of ${MAX_RECONNECT_ATTEMPTS}`);
				mockEventSource.onerror?.(new Event('error'));
				const delay = 1000 * Math.pow(2, i - 1);
				jest.advanceTimersByTime(delay);
				jest.runAllTimers();
			})
		}

		await waitFor(() => {
			const alertElement = screen.getByTestId('reconnect-alert');
			expect(alertElement).toBeInTheDocument();
			expect(alertElement).toHaveTextContent(/maximum reconnect attempts/i);
		}, { timeout: 2000 });

		expect(global.EventSource).toHaveBeenCalledTimes(MAX_RECONNECT_ATTEMPTS);
	})


})