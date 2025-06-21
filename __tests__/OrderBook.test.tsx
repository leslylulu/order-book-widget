import { render, screen, act } from "@testing-library/react";
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
		jest.clearAllTimers();
	});

	test('connect to the /api/order-stream', () => {
		render(<OrderBook/>);
		expect(global.EventSource).toHaveBeenCalledWith('/api/order-stream');
	})
})